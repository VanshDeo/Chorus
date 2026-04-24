// ── Update Graph Job Registration ───────────────
import { Worker } from 'bullmq';
import { QueueName } from '@chorus/shared-types';
import type { UpdateGraphJobPayload } from '@chorus/shared-types';
import { processUpdateGraph } from '../processors/updateGraph.processor';
import { connection } from '../redis';

export function registerUpdateGraphJob() {
  new Worker<UpdateGraphJobPayload>(
    QueueName.UPDATE_GRAPH,
    async (job) => { await processUpdateGraph(job.data); },
    { connection, concurrency: 3 },
  );
}
