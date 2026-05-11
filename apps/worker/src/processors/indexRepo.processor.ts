// ── Index Repo Processor ────────────────────────
import type { IndexRepoJobPayload } from '@chorus/shared-types';
import { fetchRepository, parseGitHubUrl } from '../../../../apps/api/src/rag/ingestion/githubFetcher';
import { filterFiles } from '../../../../apps/api/src/rag/ingestion/fileFilter';
import { chunkFiles } from '../../../../apps/api/src/rag/ingestion/astChunker';
import { embedChunks } from '../../../../apps/api/src/rag/embeddings/embeddingEngine';
import { writeToVectorStore, fetchLatestCommitHash } from '../../../../apps/api/src/rag/vectorstore/vectorStoreWriter';

export async function processIndexRepo(payload: IndexRepoJobPayload): Promise<void> {
  const { repoId, repoUrl, branch } = payload;

  try {
    const { owner, repo } = parseGitHubUrl(repoUrl);
    const githubToken = process.env.GITHUB_TOKEN;

    // 1. Fetch latest commit hash to see if we can skip
    const commitHash = await fetchLatestCommitHash(owner, repo, branch, githubToken);

    // 2. Fetch repo files and metadata
    console.log(`[Worker] Fetching repository: ${repoUrl}`);
    const fetchResult = await fetchRepository(repoUrl, githubToken);

    // 3. Filter valid files
    console.log(`[Worker] Filtering files...`);
    const filterResult = filterFiles(fetchResult.files);

    // 4. Chunk files
    console.log(`[Worker] Chunking ${filterResult.accepted.length} files...`);
    const repoIdentifier = `${owner}/${repo}`;
    const chunks = chunkFiles(repoIdentifier, filterResult.accepted);

    // 5. Generate embeddings
    console.log(`[Worker] Embedding ${chunks.length} chunks...`);
    const embeddingResult = await embedChunks(chunks);

    // 6. Write to pgvector store
    console.log(`[Worker] Writing chunks to vector store...`);
    await writeToVectorStore(embeddingResult.embedded, {
      repoMeta: fetchResult.meta,
      commitHash: commitHash ?? undefined,
      embeddingModel: embeddingResult.model
    });

    console.log(`[Worker] Successfully indexed repo ${repoId}`);
  } catch (err) {
    console.error(`[Worker] Failed to index repo ${repoId}:`, err);
    throw err;
  }
}
