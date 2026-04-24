// ── Reindex Chunks Job Registration ─────────────
import { Worker } from 'bullmq';
import { QueueName } from '@chorus/shared-types';
import type { ReindexChunksJobPayload } from '@chorus/shared-types';
import { processReindexChunks } from '../processors/reindexChunks.processor';
import { connection } from '../redis';

export function registerReindexChunksJob() {
  new Worker<ReindexChunksJobPayload>(
    QueueName.REINDEX_CHUNKS,
    async (job) => { await processReindexChunks(job.data); },
    { connection, concurrency: 1 },
  );
}
