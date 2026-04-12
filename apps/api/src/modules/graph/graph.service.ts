// ── Graph Service ───────────────────────────────

import type { DiagramData, GraphLevel } from '@chorus/shared-types';
import { GraphModel } from '../../db/models/Graph.model';
import { getCachedGraph, setCachedGraph } from '../../cache/graphSnapshots';
import { generateArchitectureGraph } from './architectureAgent';

export class GraphService {
  async getGraph(repoId: string, level: GraphLevel = 'module', commitSha?: string): Promise<DiagramData | null> {
    // Try cache first
    if (commitSha) {
      const cached = await getCachedGraph(repoId, level, commitSha);
      if (cached) return cached;
    }

    // Fall back to PostgreSQL — findOne already sorts by generatedAt desc
    const query: Record<string, unknown> = { repoId, level };
    if (commitSha) query.commitSha = commitSha;

    const graph = await GraphModel.findOne(query);
    if (!graph) return null;

    const data = graph.toObject() as unknown as DiagramData;

    // Cache for next time
    if (data.commitSha) {
      await setCachedGraph(repoId, level, data.commitSha, data);
    }

    return data;
  }

  async getArchitectureGraph(repoId: string, commitSha?: string): Promise<any | null> {
    const level = 'architecture';

    // Fall back to PostgreSQL — findOne already sorts by generatedAt desc
    const query: Record<string, unknown> = { repoId, level };
    if (commitSha) query.commitSha = commitSha;

    let graph = await GraphModel.findOne(query);

    if (graph) {
      return graph.toObject();
    }

    // Dynamic generation using RAG on cache miss
    try {
      const [owner, name] = repoId.split('/');

      const generatedGraph = await generateArchitectureGraph(owner, name);
      console.log(`[GraphService] Successfully dynamically generated architecture for ${repoId}`);

      graph = await GraphModel.create({
        repoId,
        level,
        commitSha: commitSha || 'latest',
        ...generatedGraph,
      });

      return graph.toObject();
    } catch (err) {
      console.error(`[GraphService] Error generating architecture graph for ${repoId}:`, err);
      return null;
    }
  }
}
