// ── Repo Repository (replaces Mongoose model) ───
import { eq, desc, sql } from 'drizzle-orm';
import { db } from '../connection';
import { repos, userRepoMetrics, type RepoRow, type UserRepoMetricRow } from '../schema';
import { type CommunityHealthResult } from '../../modules/repo/communityHealth';
import { type RepoDifficultyResult } from '../../modules/repo/repoDifficulty';

// ── Type exported for service compatibility ────────────────────────────────────
export interface IRepo {
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
  communityHealth?: CommunityHealthResult;
  lastCommitSha?: string;
  lastAnalyzedAt?: Date;
  createdAt: Date;
  updatedAt: Date;

  // Mutable fields (for save() pattern used in repo.service.ts)
  _stars: number;
  _forks: number;
  _openIssues: number;
  _id: string;

  toObject(): Omit<IRepo, 'toObject' | 'save' | '_stars' | '_forks' | '_openIssues' | '_id'>;
  save(): Promise<void>;
}

// ── Row → Domain ───────────────────────────────────────────────────────────────
function toRepo(row: RepoRow): IRepo {
  const obj = {
    id: row.id,
    _id: row.id,
    repoUrl: row.repoUrl,
    owner: row.owner,
    name: row.name,
    defaultBranch: row.defaultBranch,
    description: row.description ?? undefined,
    language: row.language ?? undefined,
    stars: row.stars,
    forks: row.forks,
    openIssues: row.openIssues,
    communityHealth: (row.communityHealth as CommunityHealthResult) ?? undefined,
    lastCommitSha: row.lastCommitSha ?? undefined,
    lastAnalyzedAt: row.lastAnalyzedAt ?? undefined,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,

    // Internal mutable state
    _stars: row.stars,
    _forks: row.forks,
    _openIssues: row.openIssues,

    toObject() {
      return {
        id: obj.id,
        repoUrl: obj.repoUrl,
        owner: obj.owner,
        name: obj.name,
        defaultBranch: obj.defaultBranch,
        description: obj.description,
        language: obj.language,
        stars: obj.stars,
        forks: obj.forks,
        openIssues: obj.openIssues,
        communityHealth: obj.communityHealth,
        lastCommitSha: obj.lastCommitSha,
        lastAnalyzedAt: obj.lastAnalyzedAt,
        createdAt: obj.createdAt,
        updatedAt: obj.updatedAt,
      };
    },

    async save() {
      await db
        .update(repos)
        .set({
          stars: obj.stars,
          forks: obj.forks,
          openIssues: obj.openIssues,
          communityHealth: obj.communityHealth,
          lastCommitSha: obj.lastCommitSha,
          lastAnalyzedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(repos.id, obj.id));
    },
  };

  return obj;
}

// ── RepoModel (Mongoose-compatible API) ───────────────────────────────────────
export const RepoModel = {
  async findOne(filter: { repoUrl: string }): Promise<IRepo | null> {
    const [row] = await db
      .select()
      .from(repos)
      .where(eq(repos.repoUrl, filter.repoUrl))
      .limit(1);
    return row ? toRepo(row) : null;
  },

  async findById(id: string): Promise<IRepo | null> {
    const [row] = await db.select().from(repos).where(eq(repos.id, id)).limit(1);
    return row ? toRepo(row) : null;
  },

  async create(data: {
    repoUrl: string;
    owner: string;
    name: string;
    defaultBranch?: string;
    description?: string;
    language?: string;
    stars?: number;
    forks?: number;
    openIssues?: number;
    communityHealth?: CommunityHealthResult;
    lastCommitSha?: string;
  }): Promise<IRepo> {
    const [row] = await db
      .insert(repos)
      .values({
        repoUrl: data.repoUrl,
        owner: data.owner,
        name: data.name,
        defaultBranch: data.defaultBranch ?? 'main',
        description: data.description,
        language: data.language,
        stars: data.stars ?? 0,
        forks: data.forks ?? 0,
        openIssues: data.openIssues ?? 0,
        communityHealth: data.communityHealth,
        lastCommitSha: data.lastCommitSha,
      })
      .returning();
    return toRepo(row);
  },

  async find(
    _filter?: Record<string, unknown>,
  ): Promise<Array<IRepo>> {
    // Returns a chainable query builder-like object
    const rows = await db.select().from(repos).orderBy(desc(repos.updatedAt));
    return rows.map(toRepo);
  },
};

// ── UserRepoMetricsModel ──────────────────────────────────────────────────────

export const UserRepoMetricsModel = {
  async findOne(userId: string, repoId: string): Promise<UserRepoMetricRow | null> {
    const [row] = await db
      .select()
      .from(userRepoMetrics)
      .where(sql`${userRepoMetrics.userId} = ${userId} AND ${userRepoMetrics.repoId} = ${repoId}`)
      .limit(1);
    return row ?? null;
  },

  async upsert(data: {
    userId: string;
    repoId: string;
    difficulty: RepoDifficultyResult;
    lastCommitSha: string;
  }): Promise<void> {
    await db
      .insert(userRepoMetrics)
      .values({
        userId: data.userId,
        repoId: data.repoId,
        difficulty: data.difficulty,
        lastCommitSha: data.lastCommitSha,
        updatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: [userRepoMetrics.userId, userRepoMetrics.repoId],
        set: {
          difficulty: data.difficulty,
          lastCommitSha: data.lastCommitSha,
          updatedAt: new Date(),
        },
      });
  },
};

// ── Fluent Query Builder for find().sort().skip().limit() ─────────────────────

export const RepoQuery = {
  find() {
    let _limit = 20;
    let _offset = 0;

    const builder = {
      sort(_by: Record<string, unknown>) {
        // Always sort by updatedAt desc (matches Mongoose .sort({ updatedAt: -1 }))
        return builder;
      },
      skip(n: number) {
        _offset = n;
        return builder;
      },
      limit(n: number) {
        _limit = n;
        return builder;
      },
      async exec(): Promise<IRepo[]> {
        const rows = await db
          .select()
          .from(repos)
          .orderBy(desc(repos.updatedAt))
          .limit(_limit)
          .offset(_offset);
        return rows.map(toRepo);
      },
      then(resolve: (value: IRepo[]) => void, reject: (reason: unknown) => void) {
        return builder.exec().then(resolve, reject);
      },
    };

    return builder;
  },
};
