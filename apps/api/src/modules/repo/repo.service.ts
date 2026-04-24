// ── Repo Service ────────────────────────────────

import type { Repository } from '@chorus/shared-types';
import { RepoModel, RepoQuery, UserRepoMetricsModel, type IRepo } from '../../db/models/Repo.model';
import type { UserRepoMetricRow } from '../../db/schema';
import { indexRepoQueue } from '../../queue/indexRepo.queue';
import { Octokit } from '@octokit/rest';
import {
  fetchRepoLanguages,
  fetchUserLanguageProfile,
  calculateRepoDifficulty,
  type RepoDifficultyResult,
} from './repoDifficulty';
import {
  fetchCommunityHealthInputs,
  calculateCommunityHealth,
  type CommunityHealthResult,
} from './communityHealth';

// ─── Extended Analysis Result ─────────────────────────────────────────────────

export interface RepoAnalysisResult {
  repo: Repository;
  jobId: string;
  difficulty?: RepoDifficultyResult;
  communityHealth?: CommunityHealthResult;
  trends?: {
    difficultyScore?: number;
    communityHealthScore?: number;
  };
}

export class RepoService {
  /**
   * Analyzes a repository by URL.
   * - Fetches live repo metadata from GitHub
   * - Calculates community health score (formula, no RAG)
   * - If a userId/username is provided, calculates personalized difficulty (formula, no RAG)
   * - Enqueues background indexing job for RAG pipeline
   */
  async analyzeRepo(
    repoUrl: string,
    userId?: string,
    githubUsername?: string,
  ): Promise<RepoAnalysisResult> {
    const cleanUrl = repoUrl.replace(/\.git$/, '').replace(/\/$/, '');
    const parts = cleanUrl.split('/');
    const name = parts.pop() || '';
    const owner = parts.pop() || '';

    if (!owner || !name) {
      throw new Error(`Invalid repository URL: ${repoUrl}`);
    }

    console.log(`[RepoService] Analyzing repo: ${owner}/${name}`);
    const githubToken = process.env.GITHUB_TOKEN;
    if (!githubToken) {
      console.warn('[RepoService] GITHUB_TOKEN is missing. GitHub API calls may fail or be rate-limited.');
    }

    const octokit = new Octokit({ auth: githubToken || undefined });

    // ── Get Repository and Latest Commit SHA ──────────────────────────────────
    let repoData: any;
    let latestSha = '';
    try {
      const { data } = await octokit.repos.get({ owner, repo: name });
      repoData = data;
      const { data: branchData } = await octokit.repos.getBranch({
        owner,
        repo: name,
        branch: repoData.default_branch,
      });
      latestSha = branchData.commit.sha;
    } catch (err) {
      console.error(`[RepoService] Error fetching repo/branch data: ${err}`);
      throw new Error(`Could not fetch data for ${owner}/${name}`);
    }

    // ── Fetch existing repo from DB ──────────────────────────────────────────
    let repo = await RepoModel.findOne({ repoUrl });
    let existingRepoMetrics: UserRepoMetricRow | null = null;
    if (userId && repo) {
      existingRepoMetrics = await UserRepoMetricsModel.findOne(userId, repo.id);
    }

    const isRepoUpToDate = repo?.lastCommitSha === latestSha;
    const isUserMetricsUpToDate = existingRepoMetrics?.lastCommitSha === latestSha;

    // ── Check if we can return cached results ────────────────────────────────
    // If the repo and user metrics are already computed for the latest commit,
    // serve the persisted values directly and avoid re-running indexing.
    if (isRepoUpToDate && isUserMetricsUpToDate && repo?.communityHealth && existingRepoMetrics?.difficulty) {
      console.log(`[RepoService] Serving cached metrics for ${owner}/${name} at ${latestSha}`);

      return {
        repo: repo!.toObject() as unknown as Repository,
        jobId: `cached-${repo!.id}`,
        difficulty: existingRepoMetrics.difficulty as RepoDifficultyResult,
        communityHealth: repo.communityHealth,
        trends: {
          difficultyScore: 0,
          communityHealthScore: 0,
        },
      };
    }

    // ── Recalculate Metrics ──────────────────────────────────────────────────
    console.log(`[RepoService] Metrics stale or missing for ${owner}/${name}. Recalculating...`);

    let liveStars = repoData.stargazers_count;
    let liveForks = repoData.forks_count;
    let liveOpenIssues = repoData.open_issues_count;
    let hasTests = false;
    let hasContributingGuide = false;
    let dependencyCount = 0;

    try {
      // Check for CONTRIBUTING.md and test directories (best-effort)
      const { data: rootTree } = await octokit.git.getTree({
        owner,
        repo: name,
        tree_sha: latestSha,
        recursive: '0',
      });
      const rootPaths = rootTree.tree.map((f) => f.path?.toLowerCase() ?? '');
      hasContributingGuide = rootPaths.some((p) => p.includes('contributing'));
      hasTests = rootPaths.some((p) => p === 'tests' || p === 'test' || p === '__tests__' || p === 'spec');

      const pkgJson = rootTree.tree.find((f) => f.path === 'package.json');
      if (pkgJson?.size) {
        dependencyCount = Math.round((pkgJson.size ?? 0) / 30);
      }
    } catch (err) {
      console.warn('[RepoService] Could not fetch file tree:', err);
    }

    // ── Community Health ─────────────────────────────────────────────────────
    let communityHealth: CommunityHealthResult | undefined;
    try {
      const healthInputs = await fetchCommunityHealthInputs(owner, name, githubToken);
      communityHealth = calculateCommunityHealth(healthInputs);
    } catch (err) {
      console.warn('[RepoService] Community health calculation failed:', err);
    }

    // ── Personalized Difficulty ─────────────────────────────────────────────
    let difficulty: RepoDifficultyResult | undefined;
    if (githubUsername) {
      try {
        const [repoLanguages, userProfile] = await Promise.all([
          fetchRepoLanguages(owner, name, githubToken),
          fetchUserLanguageProfile(githubUsername, githubToken),
        ]);
        difficulty = calculateRepoDifficulty(userProfile, repoLanguages, {
          fileCount: 0,
          dependencyCount,
          hasContributingGuide,
          hasTests,
        });
      } catch (err) {
        console.warn('[RepoService] Difficulty calculation failed:', err);
      }
    }

    // ── Calculate Trends ─────────────────────────────────────────────────────
    const trends = {
      difficultyScore: 0,
      communityHealthScore: 0,
    };

    if (communityHealth && repo?.communityHealth) {
      trends.communityHealthScore = communityHealth.score - repo.communityHealth.score;
    }
    if (difficulty && existingRepoMetrics?.difficulty) {
      const prevDiff = (existingRepoMetrics.difficulty as RepoDifficultyResult).rampScore;
      trends.difficultyScore = difficulty.rampScore - prevDiff;
    }

    // ── Upsert Repo in DB ────────────────────────────────────────────────────
    if (!repo) {
      repo = await RepoModel.create({
        repoUrl,
        owner,
        name,
        defaultBranch: repoData.default_branch,
        stars: liveStars,
        forks: liveForks,
        openIssues: liveOpenIssues,
        communityHealth,
        lastCommitSha: latestSha,
      });
    } else {
      repo.stars = liveStars;
      repo.forks = liveForks;
      repo.openIssues = liveOpenIssues;
      repo.communityHealth = communityHealth;
      repo.lastCommitSha = latestSha;
      await repo.save();
    }

    // ── Upsert User Metrics in DB ───────────────────────────────────────────
    if (userId) {
      await UserRepoMetricsModel.upsert({
        userId,
        repoId: repo.id,
        difficulty,
        lastCommitSha: latestSha,
      });
    }

    // ── Enqueue background RAG indexing job ──────────────────────────────────
    const job = await indexRepoQueue.add('index-repo', {
      repoId: repo.id,
      repoUrl,
      branch: repo.defaultBranch,
      userId: userId ?? '',
    });

    return {
      repo: repo.toObject() as unknown as Repository,
      jobId: job.id!,
      difficulty,
      communityHealth,
      trends,
    };
  }

  /**
   * Gets a repository by ID.
   */
  async getRepoById(repoId: string): Promise<Repository | null> {
    const repo = await RepoModel.findById(repoId);
    return repo ? (repo.toObject() as unknown as Repository) : null;
  }

  /**
   * Lists all analyzed repositories.
   */
  async listRepos(limit = 20, offset = 0): Promise<Repository[]> {
    const repos = await RepoQuery.find().sort({ updatedAt: -1 }).skip(offset).limit(limit);
    return repos.map((r) => r.toObject() as unknown as Repository);
  }
}
