import { QuestManager } from "../../utils";

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

export function calculateLevel(xp: number): number {
  if (xp < 100) return 1;
  return Math.floor(Math.log2(xp / 100)) + 1;
}

export async function issueToQuest(issueUrl: string): Promise<Quest> {
  const manager = new QuestManager();
  return manager.convertIssueToQuest(issueUrl);
}
