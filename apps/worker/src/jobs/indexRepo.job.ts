// ── Index Repo Job Registration ─────────────────
import { Worker } from 'bullmq';
import { QueueName } from '@chorus/shared-types';
import type { IndexRepoJobPayload } from '@chorus/shared-types';
import { processIndexRepo } from '../processors/indexRepo.processor';
import { connection } from '../redis';

export function registerIndexRepoJob() {
  new Worker<IndexRepoJobPayload>(
    QueueName.INDEX_REPO,
    async (job) => { await processIndexRepo(job.data); },
    { connection, concurrency: 2 },
  );
}
