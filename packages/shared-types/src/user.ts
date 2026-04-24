// ── User Types ───────────────────────────────────
export const USER_RUNTIME = true;

export interface User {
  id: string;
  githubId: string;
  username: string;
  displayName: string;
  avatarUrl: string;
  email?: string;
  skillProfile?: SkillProfile;
  onboardingComplete?: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface AnalyzedProject {
  repo: {
    id: string;
    repoUrl: string;
    owner: string;
    name: string;
    defaultBranch: string;
    description?: string;
    language?: string;
    stars: number;
    forks: number;
    openIssues: number;
    communityHealth?: unknown;
    lastCommitSha?: string;
    lastAnalyzedAt?: Date;
    createdAt: Date;
    updatedAt: Date;
  };
  difficulty?: unknown;
  lastCommitSha?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface SkillProfile {
  userId: string;
  skillVector: SkillVector;
  experienceLevel: ExperienceLevel;
  topLanguages: Array<{ language: string; proficiency: number }>;
  topFrameworks: Array<{ framework: string; proficiency: number }>;
  contributionStats: {
    totalCommits: number;
    totalPRs: number;
    totalReviews: number;
    repositories: number;
  };
  generatedAt: Date;
}

export interface SkillVector {
  dimensions: Record<string, number>;
  magnitude: number;
}

export type ExperienceLevel = 'beginner' | 'intermediate' | 'advanced' | 'expert';
