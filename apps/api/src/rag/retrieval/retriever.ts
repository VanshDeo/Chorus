/**
 * retriever.ts
 * apps/api/src/rag/retrieval/retriever.ts
 *
 * Retrieves the most relevant CodeChunks for a given query.
 *
 * Pipeline:
 *   1. Embed the query using Gemini (asymmetric: RETRIEVAL_QUERY task type)
 *   2. Run pgvector cosine similarity search (replaces MongoDB Atlas $vectorSearch)
 *   3. Rerank by file proximity — boost chunks from files already in results
 *   4. Return final top-K chunks with scores, ready for prompt assembly
 *
 * Fallback: If pgvector search fails, falls back to in-memory cosine similarity
 * search (slower, but works without a vector index).
 */

import { ChunkModel } from '../../db/models/Chunk.model';
import { embedQuery } from '../embeddings/queryEmbedder';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface RetrievalOptions {
  repoId: string;         // "owner/repo" — scope search to one repo
  topK?: number;          // Final number of chunks to return (default: 8)
  candidateMultiplier?: number; // Fetch topK * this before reranking (default: 3)
  minScore?: number;      // Discard chunks below this cosine similarity (default: 0.3)
  fileFilter?: string[];  // Optional: only search within these file paths
}

export interface RetrievedChunk {
  id: string;
  filePath: string;
  language: string;
  content: string;
  startLine: number;
  endLine: number;
  symbolName?: string | null;
  score: number;          // Final score after reranking (0–1)
  vectorScore: number;    // Raw cosine similarity from vector search
  proximityBoost: number; // How much the reranker added
}

export interface RetrievalResult {
  query: string;
  repoId: string;
  chunks: RetrievedChunk[];
  totalCandidates: number;  // How many chunks were fetched before reranking
  durationMs: number;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const DEFAULT_TOP_K = 8;
const DEFAULT_CANDIDATE_MULTIPLIER = 3;
const DEFAULT_MIN_SCORE = 0.3;

// File proximity boost: if a file already has a chunk in top results,
// other chunks from that file get this additive score bonus
const PROXIMITY_BOOST = 0.08;

// Cap proximity boost per file so one giant file can't dominate results
const MAX_PROXIMITY_BOOST_PER_FILE = 0.16; // i.e. max 2 boosted chunks per file

// ─── Entry Point ─────────────────────────────────────────────────────────────

export async function retrieve(
  query: string,
  options: RetrievalOptions,
): Promise<RetrievalResult> {
  const startTime = Date.now();
  const topK = options.topK ?? DEFAULT_TOP_K;
  const candidateCount = topK * (options.candidateMultiplier ?? DEFAULT_CANDIDATE_MULTIPLIER);
  const minScore = options.minScore ?? DEFAULT_MIN_SCORE;

  console.log(
    `[Retriever] Query: "${query.slice(0, 80)}..." | repo: ${options.repoId} | topK: ${topK}`,
  );

  // ── Step 1: Embed the query ────────────────────────────────────────────────
  const queryVector = await embedQuery(query);

  // ── Step 2: pgvector cosine similarity search ──────────────────────────────
  let candidates: RawCandidate[];

  try {
    candidates = await pgVectorSearch(
      queryVector,
      options.repoId,
      candidateCount,
      minScore,
      options.fileFilter,
    );
  } catch (err) {
    // Fallback to in-memory cosine similarity if pgvector query fails
    console.warn(
      '[Retriever] pgvector search failed, using in-memory fallback:',
      (err as Error).message,
    );
    candidates = await inMemoryVectorSearch(
      queryVector,
      options.repoId,
      candidateCount,
      minScore,
      options.fileFilter,
    );
  }

  console.log(`[Retriever] Vector search returned ${candidates.length} candidates`);

  // ── Step 3: Rerank by file proximity ──────────────────────────────────────
  const reranked = rerankByFileProximity(candidates, topK);

  const durationMs = Date.now() - startTime;

  console.log(
    `[Retriever] ✅ Returning ${reranked.length} chunks after reranking (${durationMs}ms)`,
  );

  return {
    query,
    repoId: options.repoId,
    chunks: reranked,
    totalCandidates: candidates.length,
    durationMs,
  };
}

// ─── Raw Candidate Type ───────────────────────────────────────────────────────

export interface RawCandidate {
  id: string;
  filePath: string;
  language: string;
  content: string;
  startLine: number;
  endLine: number;
  symbolName: string | null;
  vectorScore: number;
}

// ─── pgvector Cosine Similarity Search ───────────────────────────────────────

/**
 * Uses PostgreSQL pgvector's `<=>` cosine distance operator.
 *
 * Requires a vector index on code_chunks.embedding (created by migrate.ts):
 *   CREATE INDEX chunks_embedding_hnsw_idx ON code_chunks
 *   USING hnsw (embedding vector_cosine_ops)
 *
 * The <=> operator returns cosine distance (0 = identical, 2 = opposite).
 * We convert to similarity: score = 1 - distance.
 */
async function pgVectorSearch(
  queryVector: number[],
  repoId: string,
  limit: number,
  minScore: number,
  fileFilter?: string[],
): Promise<RawCandidate[]> {
  const results = await ChunkModel.vectorSearch(
    queryVector,
    repoId,
    limit,
    minScore,
    fileFilter,
  );

  return results;
}

// ─── In-Memory Fallback ───────────────────────────────────────────────────────

/**
 * Fallback for when the pgvector index isn't available yet.
 * Loads all chunks for the repo into memory and computes cosine similarity.
 * Only practical for small repos (< ~5000 chunks).
 */
async function inMemoryVectorSearch(
  queryVector: number[],
  repoId: string,
  limit: number,
  minScore: number,
  fileFilter?: string[],
): Promise<RawCandidate[]> {
  const filter: { repoId: string; filePath?: { $in: string[] } } = { repoId };
  if (fileFilter && fileFilter.length > 0) {
    filter.filePath = { $in: fileFilter };
  }

  // Fetch all chunks for this repo (with embeddings)
  const chunks = await ChunkModel.find(filter);

  if (chunks.length === 0) return [];

  console.log(`[Retriever] In-memory search over ${chunks.length} chunks`);

  // Compute cosine similarity for each chunk
  const scored = chunks
    .map((chunk) => {
      const sim = cosineSimilarity(queryVector, chunk.embedding);
      return {
        id: chunk.chunkId,
        filePath: chunk.filePath,
        language: chunk.language,
        content: chunk.content,
        startLine: chunk.startLine,
        endLine: chunk.endLine,
        symbolName: chunk.symbolName,
        vectorScore: sim,
      };
    })
    .filter((c) => c.vectorScore >= minScore)
    .sort((a, b) => b.vectorScore - a.vectorScore)
    .slice(0, limit);

  return scored;
}

// ─── File Proximity Reranker ──────────────────────────────────────────────────

/**
 * Reranks candidates using a two-pass approach:
 *
 * Pass 1 — Identify "anchor files":
 *   The top-N chunks by raw vector score determine which files are "hot".
 *   We use the top 3 chunks as anchors.
 *
 * Pass 2 — Boost + sort:
 *   Any candidate from an anchor file gets a proximity boost added to its score.
 *   Boost is capped per file to prevent one large file dominating.
 *   Final sort is by boosted score descending, then take top-K.
 */
export function rerankByFileProximity(
  candidates: RawCandidate[],
  topK: number,
): RetrievedChunk[] {
  if (candidates.length === 0) return [];

  const ANCHOR_COUNT = Math.min(3, candidates.length);

  // Pass 1: collect anchor files from top-N by vector score
  const anchorFiles = new Set(
    candidates.slice(0, ANCHOR_COUNT).map((c) => c.filePath),
  );

  // Track how much boost has been applied per file (cap enforcement)
  const boostApplied = new Map<string, number>();

  // Pass 2: compute final scores
  const scored: RetrievedChunk[] = candidates.map((candidate) => {
    let proximityBoost = 0;

    if (anchorFiles.has(candidate.filePath)) {
      const alreadyBoosted = boostApplied.get(candidate.filePath) ?? 0;

      if (alreadyBoosted < MAX_PROXIMITY_BOOST_PER_FILE) {
        proximityBoost = Math.min(
          PROXIMITY_BOOST,
          MAX_PROXIMITY_BOOST_PER_FILE - alreadyBoosted,
        );
        boostApplied.set(candidate.filePath, alreadyBoosted + proximityBoost);
      }
    }

    return {
      id: candidate.id,
      filePath: candidate.filePath,
      language: candidate.language,
      content: candidate.content,
      startLine: candidate.startLine,
      endLine: candidate.endLine,
      symbolName: candidate.symbolName,
      vectorScore: candidate.vectorScore,
      proximityBoost,
      score: candidate.vectorScore + proximityBoost,
    };
  });

  // Sort by final score descending, take topK
  return scored
    .sort((a, b) => b.score - a.score)
    .slice(0, topK);
}

// ─── Cosine Similarity ───────────────────────────────────────────────────────

function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) return 0;

  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }

  const denominator = Math.sqrt(normA) * Math.sqrt(normB);
  return denominator === 0 ? 0 : dotProduct / denominator;
}