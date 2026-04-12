// ── RepoIndex Repository (replaces Mongoose model) ─
// Tracks which repos have been indexed, their commit hash, and chunk stats.
// Used by the vector store writer to skip re-indexing unchanged repos.
import { eq } from 'drizzle-orm';
import { db } from '../connection';
import { repoIndex, type RepoIndexRow } from '../schema';

// ── Interface preserved for compatibility ─────────────────────────────────────
export interface IRepoIndex {
  id: string;
  repoId: string;
  commitHash: string | null;
  defaultBranch: string;
  sizeKB: number;
  fileCount: number;
  chunkCount: number;
  embeddingModel: string;
  updatedAt: Date;
}

// ── Row → Domain ───────────────────────────────────────────────────────────────
function toRepoIndex(row: RepoIndexRow): IRepoIndex {
  return {
    id: row.id,
    repoId: row.repoId,
    commitHash: row.commitHash ?? null,
    defaultBranch: row.defaultBranch,
    sizeKB: row.sizeKB,
    fileCount: row.fileCount,
    chunkCount: row.chunkCount,
    embeddingModel: row.embeddingModel,
    updatedAt: row.updatedAt,
  };
}

// ── RepoIndexModel (Mongoose-compatible API) ──────────────────────────────────
export const RepoIndexModel = {
  async findOne(filter: { repoId: string }): Promise<IRepoIndex | null> {
    const [row] = await db
      .select()
      .from(repoIndex)
      .where(eq(repoIndex.repoId, filter.repoId))
      .limit(1);
    return row ? toRepoIndex(row) : null;
  },

  async findOneAndUpdate(
    filter: { repoId: string },
    data: {
      repoId: string;
      commitHash?: string | null;
      defaultBranch: string;
      sizeKB: number;
      fileCount: number;
      chunkCount: number;
      embeddingModel: string;
    },
    _options: { upsert: boolean; new: boolean },
  ): Promise<IRepoIndex> {
    const [existing] = await db
      .select()
      .from(repoIndex)
      .where(eq(repoIndex.repoId, filter.repoId))
      .limit(1);

    if (existing) {
      const [updated] = await db
        .update(repoIndex)
        .set({
          commitHash: data.commitHash ?? null,
          defaultBranch: data.defaultBranch,
          sizeKB: data.sizeKB,
          fileCount: data.fileCount,
          chunkCount: data.chunkCount,
          embeddingModel: data.embeddingModel,
          updatedAt: new Date(),
        })
        .where(eq(repoIndex.id, existing.id))
        .returning();
      return toRepoIndex(updated);
    }

    const [inserted] = await db
      .insert(repoIndex)
      .values({
        repoId: data.repoId,
        commitHash: data.commitHash ?? null,
        defaultBranch: data.defaultBranch,
        sizeKB: data.sizeKB,
        fileCount: data.fileCount,
        chunkCount: data.chunkCount,
        embeddingModel: data.embeddingModel,
      })
      .returning();

    return toRepoIndex(inserted);
  },
};
