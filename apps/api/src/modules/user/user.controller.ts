// ── User Controller ─────────────────────────────
import type { Request, Response } from 'express';
import { UserService } from './user.service';
import { logger } from '../../observability/logger';

const userService = new UserService();

export class UserController {
  async getProfile(req: Request, res: Response) {
    try {
      const userId = req.query.userId as string;
      if (!userId) return res.status(400).json({ error: 'userId is required' });
      const user = await userService.getUserById(userId);
      if (!user) return res.status(404).json({ error: 'User not found' });
      return res.json(user);
    } catch (err) {
      logger.error({ err }, 'Failed to get user profile');
      return res.status(500).json({ error: 'Failed to retrieve profile' });
    }
  }

  async getSkillProfile(req: Request, res: Response) {
    try {
      const userId = req.query.userId as string;
      if (!userId) return res.status(400).json({ error: 'userId is required' });
      const profile = await userService.getSkillProfile(userId);
      if (!profile) return res.status(404).json({ error: 'Skill profile not found' });
      return res.json(profile);
    } catch (err) {
      logger.error({ err }, 'Failed to get skill profile');
      return res.status(500).json({ error: 'Failed to retrieve skill profile' });
    }
  }

  async savePreferences(req: Request, res: Response) {
    try {
      const { userId, preferences, userData } = req.body;
      if (!userId) return res.status(400).json({ error: 'userId is required' });
      const user = await userService.savePreferences(userId, preferences, userData);
      return res.json(user);
    } catch (err) {
      logger.error({ err }, 'Failed to save preferences');
      return res.status(500).json({ error: 'Failed to save preferences' });
    }
  }

  async getStatus(req: Request, res: Response) {
    try {
      const userId = req.query.userId as string;
      if (!userId) return res.status(400).json({ error: 'userId is required' });
      const onboardingComplete = await userService.getOnboardingStatus(userId);
      return res.json({ onboardingComplete });
    } catch (err) {
      logger.error({ err }, 'Failed to get onboarding status');
      return res.status(500).json({ error: 'Failed to retrieve onboarding status' });
    }
  }

  async getAnalyzedProjects(req: Request, res: Response) {
    try {
      const userId = req.query.userId as string;
      if (!userId) return res.status(400).json({ error: 'userId is required' });
      const projects = await userService.getAnalyzedProjects(userId);
      return res.json({ projects });
    } catch (err) {
      logger.error({ err }, 'Failed to get analyzed projects');
      return res.status(500).json({ error: 'Failed to retrieve analyzed projects' });
    }
  }
}
