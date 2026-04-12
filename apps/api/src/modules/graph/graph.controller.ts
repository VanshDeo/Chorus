// ── Graph Controller ────────────────────────────

import type { Request, Response } from 'express';
import type { GraphLevel } from '@chorus/shared-types';
import { GraphService } from './graph.service';
import { logger } from '../../observability/logger';

const graphService = new GraphService();

export class GraphController {
  async getGraph(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const level = (req.query.level as string) || 'module';
      const commitSha = req.query.commitSha as string | undefined;

      let graph;
      if (level === 'architecture') {
        graph = await graphService.getArchitectureGraph(id, commitSha);
      } else {
        graph = await graphService.getGraph(id, level as GraphLevel, commitSha);
      }
      
      if (!graph) return res.status(404).json({ error: 'Graph not found' });
      return res.json(graph);
    } catch (err) {
      logger.error({ err }, 'Failed to get graph');
      return res.status(500).json({ error: 'Failed to retrieve graph' });
    }
  }
}
