const ANALYSIS_STORAGE_PREFIX = "chorus:analysis:";
export const PROJECTS_STORAGE_KEY = "chorus:projects:analyzed";

export function getRepoSlug(owner?: string | null, name?: string | null): string | null {
  if (!owner || !name) return null;
  return `${owner}/${name}`;
}

export function getRepoUrlFromSlug(repoSlug?: string | null): string {
  return repoSlug ? `https://github.com/${repoSlug}` : "";
}

export function getAnalyzeRoute(repoSlug: string): string {
  return `/analyze/${repoSlug}`;
}

export function getIssuesRoute(repoSlug: string): string {
  return `/issues/${repoSlug}`;
}

export function getAnalysisStorageKey(repoSlug: string): string {
  return `${ANALYSIS_STORAGE_PREFIX}${repoSlug}`;
}

export function readSavedAnalysis(repoSlug: string): {
  url?: string;
  analysisData?: unknown;
  analyzed?: boolean;
  archData?: unknown;
} | null {
  try {
    const direct = localStorage.getItem(getAnalysisStorageKey(repoSlug));
    if (direct) {
      return JSON.parse(direct);
    }

    const projects = JSON.parse(localStorage.getItem(PROJECTS_STORAGE_KEY) || "[]");
    const match = projects.find(
      (entry: any) => `${entry?.repo?.owner}/${entry?.repo?.name}` === repoSlug,
    );

    if (!match) return null;

    return {
      url: match.repo?.repoUrl ?? getRepoUrlFromSlug(repoSlug),
      analysisData: match,
      analyzed: true,
      archData: null,
    };
  } catch {
    return null;
  }
}

export function saveAnalysisSnapshot(
  repoSlug: string,
  snapshot: {
    url: string;
    analysisData: unknown;
    analyzed: boolean;
    archData?: unknown;
  },
): void {
  localStorage.setItem(getAnalysisStorageKey(repoSlug), JSON.stringify(snapshot));
}

