// ── SecurityReport Repository (replaces Mongoose model) ─
import { eq, desc } from 'drizzle-orm';
import { db } from '../connection';
import { securityReports, type SecurityReportRow } from '../schema';
import type { SecurityReport } from '@chorus/shared-types';

// ── Interface preserved for compatibility ─────────────────────────────────────
export interface ISecurityReport {
  id: string;
  repoId: string;
  vulnerabilities: unknown[];
  secretFindings: unknown[];
  licenseInfo: unknown[];
  overallRiskScore: number;
  generatedAt: Date;

  toObject(): Omit<ISecurityReport, 'toObject'>;
}

// ── Row → Domain ───────────────────────────────────────────────────────────────
function toSecurityReport(row: SecurityReportRow): ISecurityReport {
  const obj: ISecurityReport = {
    id: row.id,
    repoId: row.repoId,
    vulnerabilities: (row.vulnerabilities as unknown[]) ?? [],
    secretFindings: (row.secretFindings as unknown[]) ?? [],
    licenseInfo: (row.licenseInfo as unknown[]) ?? [],
    overallRiskScore: Number(row.overallRiskScore),
    generatedAt: row.generatedAt,

    toObject() {
      return {
        id: obj.id,
        repoId: obj.repoId,
        vulnerabilities: obj.vulnerabilities,
        secretFindings: obj.secretFindings,
        licenseInfo: obj.licenseInfo,
        overallRiskScore: obj.overallRiskScore,
        generatedAt: obj.generatedAt,
      };
    },
  };

  return obj;
}

// ── SecurityReportModel (Mongoose-compatible API) ─────────────────────────────
export const SecurityReportModel = {
  async findOne(
    filter: { repoId: string },
    sortBy: { generatedAt: -1 } = { generatedAt: -1 },
  ): Promise<ISecurityReport | null> {
    void sortBy; // always sort by generatedAt desc

    const [row] = await db
      .select()
      .from(securityReports)
      .where(eq(securityReports.repoId, filter.repoId))
      .orderBy(desc(securityReports.generatedAt))
      .limit(1);

    return row ? toSecurityReport(row) : null;
  },
};
