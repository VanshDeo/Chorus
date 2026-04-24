// ── User Service ────────────────────────────────
import { desc, eq } from 'drizzle-orm';
import type { User, SkillProfile, AnalyzedProject } from '@chorus/shared-types';
import { UserModel } from '../../db/models/User.model';
import { db } from '../../db/connection';
import { repos, userRepoMetrics } from '../../db/schema';

export class UserService {
  async getUserById(userId: string): Promise<User | null> {
    const user = await UserModel.findById(userId);
    return user as unknown as User | null;
  }

  async getSkillProfile(userId: string): Promise<SkillProfile | null> {
    const user = await UserModel.findById(userId);
    return (user?.skillProfile as unknown as SkillProfile) ?? null;
  }

  async getOnboardingStatus(userId: string): Promise<boolean> {
    const user = await UserModel.findByClerkId(userId);
    return user?.onboardingComplete ?? false;
  }

  async upsertUser(githubProfile: Partial<User>): Promise<User> {
    const user = await UserModel.findOneAndUpdate(
      { githubId: githubProfile.githubId! },
      { $set: githubProfile },
      { upsert: true, new: true },
    );
    return user as unknown as User;
  }

  async savePreferences(userId: string, preferences: any, userData?: any): Promise<User> {
    const user = await UserModel.findOneAndUpdate(
      { githubId: userId },
      { 
        $set: { 
          username: userData?.username ?? '',
          displayName: userData?.fullName ?? userData?.username ?? '',
          avatarUrl: userData?.avatarUrl ?? '',
          email: userData?.email,
          skillProfile: preferences,
          onboardingComplete: true 
        } 
      },
      { upsert: true, new: true },
    );
    return user as unknown as User;
  }

  async getAnalyzedProjects(userId: string): Promise<AnalyzedProject[]> {
    const rows = await db
      .select({
        repo: repos,
        difficulty: userRepoMetrics.difficulty,
        lastCommitSha: userRepoMetrics.lastCommitSha,
        createdAt: userRepoMetrics.createdAt,
        updatedAt: userRepoMetrics.updatedAt,
      })
      .from(userRepoMetrics)
      .innerJoin(repos, eq(userRepoMetrics.repoId, repos.id))
      .where(eq(userRepoMetrics.userId, userId))
      .orderBy(desc(userRepoMetrics.updatedAt));

    return rows.map((row) => ({
      repo: {
        id: row.repo.id,
        repoUrl: row.repo.repoUrl,
        owner: row.repo.owner,
        name: row.repo.name,
        defaultBranch: row.repo.defaultBranch,
        description: row.repo.description ?? undefined,
        language: row.repo.language ?? undefined,
        stars: row.repo.stars,
        forks: row.repo.forks,
        openIssues: row.repo.openIssues,
        communityHealth: row.repo.communityHealth ?? undefined,
        lastCommitSha: row.repo.lastCommitSha ?? undefined,
        lastAnalyzedAt: row.repo.lastAnalyzedAt ?? undefined,
        createdAt: row.repo.createdAt,
        updatedAt: row.repo.updatedAt,
      },
      difficulty: row.difficulty ?? undefined,
      lastCommitSha: row.lastCommitSha ?? undefined,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    }));
  }
}
