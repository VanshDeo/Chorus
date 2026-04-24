// ── Worker Bootstrap ────────────────────────────
import 'dotenv/config';

import { QueueName } from '@chorus/shared-types';
import { registerIndexRepoJob } from './jobs/indexRepo.job';
import { registerUpdateGraphJob } from './jobs/updateGraph.job';
import { registerScanSecurityJob } from './jobs/scanSecurity.job';
import { registerReindexChunksJob } from './jobs/reindexChunks.job';

async function startWorker() {
  console.log('Starting Chorus Worker...');

  // Register all job processors
  registerIndexRepoJob();
  registerUpdateGraphJob();
  registerScanSecurityJob();
  registerReindexChunksJob();

  console.log(`Worker registered processors for queues: ${Object.values(QueueName).join(', ')}`);
  console.log('Worker is ready and waiting for jobs...');

  // Graceful shutdown
  const shutdown = async () => {
    console.log('Worker shutting down...');
    process.exit(0);
  };

  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
}

startWorker().catch((err) => {
  console.error('Failed to start worker:', err);
  process.exit(1);
});
