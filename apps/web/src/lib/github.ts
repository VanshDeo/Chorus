// ── GitHub Stats Fetcher ─────────────────────────
// Fetches real stats from GitHub's public REST API using the username.

export interface GitHubStats {
    publicRepos: number;
    followers: number;
    following: number;
    totalStars: number;
    totalForks: number;
    contributions: number; // approximate from recent events
    prsMerged: number;     // approximate from recent events
    languages: Record<string, number>; // language → repo count
    topRepos: {
        name: string;
        stars: number;
        forks: number;
        language: string | null;
        url: string;
        description: string | null;
    }[];
    bio: string | null;
    company: string | null;
    location: string | null;
    blog: string | null;
    createdAt: string;
}

const CACHE_KEY = "chorus:github:stats";
const CACHE_TTL = 10 * 60 * 1000; // 10 minutes

export async function fetchGitHubStats(username: string): Promise<GitHubStats> {
    // Check cache first
    try {
        const cached = localStorage.getItem(CACHE_KEY);
        if (cached) {
            const { data, timestamp, cachedUser } = JSON.parse(cached);
            if (cachedUser === username && Date.now() - timestamp < CACHE_TTL) {
                return data as GitHubStats;
            }
        }
    } catch { /* ignore cache errors */ }

    // Fetch user profile
    const userRes = await fetch(`https://api.github.com/users/${username}`);
    if (!userRes.ok) throw new Error(`GitHub API error: ${userRes.status}`);
    const userData = await userRes.json();

    // Fetch all repos (paginated, up to 200)
    const repos: any[] = [];
    for (let page = 1; page <= 2; page++) {
        const res = await fetch(
            `https://api.github.com/users/${username}/repos?per_page=100&page=${page}&sort=pushed&type=owner`
        );
        if (!res.ok) break;
        const batch = await res.json();
        if (batch.length === 0) break;
        repos.push(...batch);
    }

    // Fetch recent public events (contributions, PRs)
    const eventsRes = await fetch(
        `https://api.github.com/users/${username}/events/public?per_page=100`
    );
    const events = eventsRes.ok ? await eventsRes.json() : [];

    // Calculate total stars & forks
    let totalStars = 0;
    let totalForks = 0;
    const languages: Record<string, number> = {};

    for (const repo of repos) {
        totalStars += repo.stargazers_count || 0;
        totalForks += repo.forks_count || 0;
        if (repo.language) {
            languages[repo.language] = (languages[repo.language] || 0) + 1;
        }
    }

    // Count contributions and PRs from events
    let contributions = 0;
    let prsMerged = 0;

    for (const event of events) {
        if (event.type === "PushEvent") {
            contributions += event.payload?.commits?.length || 1;
        } else if (event.type === "PullRequestEvent") {
            if (event.payload?.action === "closed" && event.payload?.pull_request?.merged) {
                prsMerged++;
            }
        }
    }

    // Top repos by stars
    const topRepos = [...repos]
        .sort((a, b) => (b.stargazers_count || 0) - (a.stargazers_count || 0))
        .slice(0, 6)
        .map((r) => ({
            name: r.name,
            stars: r.stargazers_count || 0,
            forks: r.forks_count || 0,
            language: r.language,
            url: r.html_url,
            description: r.description,
        }));

    const stats: GitHubStats = {
        publicRepos: userData.public_repos || 0,
        followers: userData.followers || 0,
        following: userData.following || 0,
        totalStars,
        totalForks,
        contributions,
        prsMerged,
        languages,
        topRepos,
        bio: userData.bio,
        company: userData.company,
        location: userData.location,
        blog: userData.blog,
        createdAt: userData.created_at,
    };

    // Cache result
    try {
        localStorage.setItem(
            CACHE_KEY,
            JSON.stringify({ data: stats, timestamp: Date.now(), cachedUser: username })
        );
    } catch { /* localStorage full, ignore */ }

    return stats;
}
