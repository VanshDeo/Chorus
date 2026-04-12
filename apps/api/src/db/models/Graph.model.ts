// ── Graph Repository (replaces Mongoose model) ──
import { eq, and, desc } from 'drizzle-orm';
import { db } from '../connection';
import { graphs, type GraphRow } from '../schema';

// ── Interface preserved for compatibility ─────────────────────────────────────
export interface IGraph {
  id: string;
  repoId: string;
  level: string;
  commitSha: string;
  nodes: unknown[];
  edges: unknown[];

  // RAG Architecture Graph specific fields
  repository?: string;
  summary?: string;
  architecturePattern?: string;
  systemType?: string;
  complexityScore?: number;
  progressiveStructure?: unknown;
  visualization?: unknown;
  tags?: string[];
  metadata?: unknown;

  generatedAt: Date;

  toObject(): Omit<IGraph, 'toObject'>;
}

// ── Row → Domain ───────────────────────────────────────────────────────────────
function toGraph(row: GraphRow): IGraph {
  const obj: IGraph = {
    id: row.id,
    repoId: row.repoId,
    level: row.level,
    commitSha: row.commitSha,
    nodes: (row.nodes as unknown[]) ?? [],
    edges: (row.edges as unknown[]) ?? [],
    repository: row.repository ?? undefined,
    summary: row.summary ?? undefined,
    architecturePattern: row.architecturePattern ?? undefined,
    systemType: row.systemType ?? undefined,
    complexityScore: row.complexityScore ? Number(row.complexityScore) : undefined,
    progressiveStructure: row.progressiveStructure ?? undefined,
    visualization: row.visualization ?? undefined,
    tags: (row.tags as string[]) ?? undefined,
    metadata: row.metadata ?? undefined,
    generatedAt: row.generatedAt,

    toObject() {
      return {
        id: obj.id,
        repoId: obj.repoId,
        level: obj.level,
        commitSha: obj.commitSha,
        nodes: obj.nodes,
        edges: obj.edges,
        repository: obj.repository,
        summary: obj.summary,
        architecturePattern: obj.architecturePattern,
        systemType: obj.systemType,
        complexityScore: obj.complexityScore,
        progressiveStructure: obj.progressiveStructure,
        visualization: obj.visualization,
        tags: obj.tags,
        metadata: obj.metadata,
        generatedAt: obj.generatedAt,
      };
    },
  };

  return obj;
}

// ── GraphModel (Mongoose-compatible API) ──────────────────────────────────────
export const GraphModel = {
  async findOne(
    filter: Record<string, unknown>,
    sortBy: { generatedAt: -1 } = { generatedAt: -1 },
  ): Promise<IGraph | null> {
    void sortBy; // always sort by generatedAt desc

    const conditions = [];
    if (filter.repoId) conditions.push(eq(graphs.repoId, filter.repoId as string));
    if (filter.level) conditions.push(eq(graphs.level, filter.level as string));
    if (filter.commitSha) conditions.push(eq(graphs.commitSha, filter.commitSha as string));

    const query = db.select().from(graphs);
    const withWhere = conditions.length > 0 ? query.where(and(...conditions)) : query;
    const [row] = await withWhere.orderBy(desc(graphs.generatedAt)).limit(1);
    return row ? toGraph(row) : null;
  },

  async create(data: Partial<IGraph> & { repoId: string; level: string; commitSha: string }): Promise<IGraph> {
    const [row] = await db
      .insert(graphs)
      .values({
        repoId: data.repoId,
        level: data.level,
        commitSha: data.commitSha,
        nodes: (data.nodes as object[]) ?? [],
        edges: (data.edges as object[]) ?? [],
        repository: data.repository,
        summary: data.summary,
        architecturePattern: data.architecturePattern,
        systemType: data.systemType,
        complexityScore: data.complexityScore !== undefined ? String(data.complexityScore) : undefined,
        progressiveStructure: data.progressiveStructure as object,
        visualization: data.visualization as object,
        tags: data.tags as object,
        metadata: data.metadata as object,
      })
      .returning();

    return toGraph(row);
  },
};
