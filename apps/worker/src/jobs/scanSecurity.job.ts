// ── Scan Security Job Registration ──────────────
import { Worker } from 'bullmq';
import { QueueName } from '@chorus/shared-types';
import type { ScanSecurityJobPayload } from '@chorus/shared-types';
import { processScanSecurity } from '../processors/scanSecurity.processor';
import { connection } from '../redis';

export function registerScanSecurityJob() {
  new Worker<ScanSecurityJobPayload>(
    QueueName.SCAN_SECURITY,
    async (job) => { await processScanSecurity(job.data); },
    { connection, concurrency: 2 },
  );
}
