// ── Chunk Repository (replaces Mongoose model) ──
// Used for RAG: stores code chunks with embeddings for pgvector similarity search.
import { eq, inArray, and } from 'drizzle-orm';
import { db, sql as pgClient } from '../connection';
import { codeChunks } from '../schema';

// ── Interface preserved for compatibility ─────────────────────────────────────
export interface IChunk {
  chunkId: string;
  repoId: string;
  filePath: string;
  startLine: number;
  endLine: number;
  content: string;
  language: string;
  chunkType: string;
  symbolName?: string;
  chunkIndex: number;
  embedding: number[];
  embeddingModel: string;
  embeddedAt: Date;
  metadata?: {
    imports?: string[];
    exports?: string[];
    dependencies?: string[];
    complexity?: number;
    tokenCount?: number;
  };
}

// ── ChunkModel (Mongoose-compatible API) ──────────────────────────────────────
export const ChunkModel = {
  /** Delete all chunks for a given repoId */
  async deleteMany(filter: { repoId: string }): Promise<{ deletedCount: number }> {
    const result = await db
      .delete(codeChunks)
      .where(eq(codeChunks.repoId, filter.repoId))
      .returning({ id: codeChunks.id });
    return { deletedCount: result.length };
  },

  /** Batch insert chunks — skips duplicates (matching ordered: false behaviour) */
  async insertMany(
    docs: Array<{
      chunkId: string;
      repoId: string;
      filePath: string;
      language: string;
      content: string;
      startLine: number;
      endLine: number;
      symbolName?: string;
      chunkIndex: number;
      embedding: number[];
      embeddingModel: string;
      embeddedAt: Date;
      metadata?: IChunk['metadata'];
    }>,
    _options?: { ordered: boolean },
  ): Promise<void> {
    if (docs.length === 0) return;

    await db
      .insert(codeChunks)
      .values(
        docs.map((d) => ({
          chunkId: d.chunkId,
          repoId: d.repoId,
          filePath: d.filePath,
          startLine: d.startLine,
          endLine: d.endLine,
          content: d.content,
          language: d.language,
          chunkType: 'block',
          symbolName: d.symbolName,
          chunkIndex: d.chunkIndex,
          embedding: d.embedding,
          embeddingModel: d.embeddingModel,
          embeddedAt: d.embeddedAt,
          metadata: d.metadata as object,
        })),
      )
      .onConflictDoNothing({ target: codeChunks.chunkId });
  },

  /** Upsert multiple chunks — mirrors Mongoose bulkWrite with updateOne+upsert */
  async bulkWrite(
    ops: Array<{
      updateOne: {
        filter: { chunkId: string };
        update: {
          $set: {
            chunkId: string;
            repoId: string;
            filePath: string;
            language: string;
            content: string;
            startLine: number;
            endLine: number;
            symbolName?: string;
            chunkIndex: number;
            embedding: number[];
            embeddingModel: string;
            embeddedAt: Date;
          };
        };
        upsert: boolean;
      };
    }>,
  ): Promise<void> {
    if (ops.length === 0) return;

    for (const op of ops) {
      const d = op.updateOne.update.$set;
      await db
        .insert(codeChunks)
        .values({
          chunkId: d.chunkId,
          repoId: d.repoId,
          filePath: d.filePath,
          startLine: d.startLine,
          endLine: d.endLine,
          content: d.content,
          language: d.language,
          chunkType: 'block',
          symbolName: d.symbolName,
          chunkIndex: d.chunkIndex,
          embedding: d.embedding,
          embeddingModel: d.embeddingModel,
          embeddedAt: d.embeddedAt,
        })
        .onConflictDoUpdate({
          target: codeChunks.chunkId,
          set: {
            filePath: d.filePath,
            startLine: d.startLine,
            endLine: d.endLine,
            content: d.content,
            language: d.language,
            symbolName: d.symbolName,
            chunkIndex: d.chunkIndex,
            embedding: d.embedding,
            embeddingModel: d.embeddingModel,
            embeddedAt: d.embeddedAt,
            updatedAt: new Date(),
          },
        });
    }
  },

  /** Find chunks by repoId and optional filePath filter — for in-memory fallback */
  async find(
    filter: { repoId: string; filePath?: { $in: string[] } },
  ): Promise<
    Array<{
      chunkId: string;
      filePath: string;
      language: string;
      content: string;
      startLine: number;
      endLine: number;
      symbolName: string | null;
      embedding: number[];
    }>
  > {
    const conditions = [eq(codeChunks.repoId, filter.repoId)];
    if (filter.filePath?.$in && filter.filePath.$in.length > 0) {
      conditions.push(inArray(codeChunks.filePath, filter.filePath.$in));
    }

    const rows = await db
      .select({
        chunkId: codeChunks.chunkId,
        filePath: codeChunks.filePath,
        language: codeChunks.language,
        content: codeChunks.content,
        startLine: codeChunks.startLine,
        endLine: codeChunks.endLine,
        symbolName: codeChunks.symbolName,
        embedding: codeChunks.embedding,
      })
      .from(codeChunks)
      .where(and(...conditions));

    return rows;
  },

  /**
   * pgvector cosine similarity search — replaces Atlas $vectorSearch.
   * Returns top-N chunks ordered by cosine similarity to the query vector.
   */
  async vectorSearch(
    queryVector: number[],
    repoId: string,
    limit: number,
    minScore: number,
    fileFilter?: string[],
  ): Promise<
    Array<{
      id: string;
      filePath: string;
      language: string;
      content: string;
      startLine: number;
      endLine: number;
      symbolName: string | null;
      vectorScore: number;
    }>
  > {
    const vectorLiteral = `[${queryVector.join(',')}]`;

    let rows: Array<{
      chunk_id: string;
      file_path: string;
      language: string;
      content: string;
      start_line: number;
      end_line: number;
      symbol_name: string | null;
      vector_score: number;
    }>;

    if (fileFilter && fileFilter.length > 0) {
      rows = await pgClient<typeof rows>`
        SELECT
          chunk_id,
          file_path,
          language,
          content,
          start_line,
          end_line,
          symbol_name,
          1 - (embedding <=> ${vectorLiteral}::vector) AS vector_score
        FROM code_chunks
        WHERE repo_id = ${repoId}
          AND file_path = ANY(${fileFilter})
          AND 1 - (embedding <=> ${vectorLiteral}::vector) >= ${minScore}
        ORDER BY embedding <=> ${vectorLiteral}::vector
        LIMIT ${limit}
      `;
    } else {
      rows = await pgClient<typeof rows>`
        SELECT
          chunk_id,
          file_path,
          language,
          content,
          start_line,
          end_line,
          symbol_name,
          1 - (embedding <=> ${vectorLiteral}::vector) AS vector_score
        FROM code_chunks
        WHERE repo_id = ${repoId}
          AND 1 - (embedding <=> ${vectorLiteral}::vector) >= ${minScore}
        ORDER BY embedding <=> ${vectorLiteral}::vector
        LIMIT ${limit}
      `;
    }

    return rows.map((r) => ({
      id: r.chunk_id,
      filePath: r.file_path,
      language: r.language,
      content: r.content,
      startLine: r.start_line,
      endLine: r.end_line,
      symbolName: r.symbol_name,
      vectorScore: Number(r.vector_score),
    }));
  },
};
