// Hacktropica Quest Engine - Main Entry Point
// This file initializes the quest system and connects to the leaderboard

import { QuestManager } from "./utils";

interface Quest {
  id: string;
  title: string;
  xpReward: number;
  difficulty: "beginner" | "intermediate" | "advanced";
  issueUrl: string;
  skillTags: string[];
}

interface User {
  id: string;
  githubUsername: string;
  totalXP: number;
  level: number;
  badges: string[];
  streak: number;
}

/**
 * Awards XP to a user when they complete a quest.
 * Also checks for level-up and badge eligibility.
 */
export async function completeQuest(userId: string, questId: string): Promise<void> {
  const manager = new QuestManager();
  const quest = await manager.getQuestById(questId);
  const user = await manager.getUserById(userId);

  if (!quest || !user) throw new Error("Quest or user not found");

  user.totalXP += quest.xpReward;
  user.level = calculateLevel(user.totalXP);

  await manager.saveUser(user);
  await manager.checkAndAwardBadges(user, quest);
}

/**
 * Calculates user level based on total XP.
 * Uses a logarithmic curve: level = floor(log2(xp / 100)) + 1
 */
export function calculateLevel(xp: number): number {
  if (xp < 100) return 1;
  return Math.floor(Math.log2(xp / 100)) + 1;
}

/**
 * Converts a GitHub issue into a Hacktropica quest.
 * Analyzes labels, body, and comments to assign difficulty and XP.
 */
export async function issueToQuest(issueUrl: string): Promise<Quest> {
  const manager = new QuestManager();
  return manager.convertIssueToQuest(issueUrl);
}
