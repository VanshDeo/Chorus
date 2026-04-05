// Hacktropica QuestManager - Utility class for all quest/user operations

export class QuestManager {
  /**
   * Fetches a quest by its ID from the database.
   */
  async getQuestById(questId: string) {
    // Simulated DB call
    return {
      id: questId,
      title: "Fix broken pagination in issue list",
      xpReward: 150,
      difficulty: "beginner" as const,
      issueUrl: "https://github.com/example/repo/issues/42",
      skillTags: ["TypeScript", "React", "Pagination"],
    };
  }

  /**
   * Fetches a user by their ID from the database.
   */
  async getUserById(userId: string) {
    return {
      id: userId,
      githubUsername: "devuser123",
      totalXP: 450,
      level: 3,
      badges: ["first-pr", "streak-7"],
      streak: 7,
    };
  }

  /**
   * Persists a user object back to the database.
   */
  async saveUser(user: any) {
    console.log(`Saving user ${user.githubUsername} with XP ${user.totalXP}`);
  }

  /**
   * Checks badge eligibility after a quest completion.
   * Badges: first-pr, streak-7, streak-30, polyglot, top-100
   */
  async checkAndAwardBadges(user: any, quest: any) {
    const earned: string[] = [];

    if (!user.badges.includes("first-pr")) {
      user.badges.push("first-pr");
      earned.push("first-pr");
    }

    if (user.streak >= 7 && !user.badges.includes("streak-7")) {
      user.badges.push("streak-7");
      earned.push("streak-7");
    }

    if (earned.length > 0) {
      console.log(`Awarded badges: ${earned.join(", ")}`);
    }
  }

  /**
   * Converts a GitHub issue URL into a structured Quest object.
   * Uses AI to analyze issue body and assign XP and difficulty.
   */
  async convertIssueToQuest(issueUrl: string) {
    return {
      id: `quest-${Date.now()}`,
      title: "Auto-generated quest from issue",
      xpReward: 100,
      difficulty: "beginner" as const,
      issueUrl,
      skillTags: ["TypeScript"],
    };
  }

  /**
   * Computes the Contribution Rank score for the leaderboard.
   * Formula: CR = Complexity × RepoQuality × ReviewQuality × Recency + DiversityBonus
   */
  computeContributionRank(
    complexity: number,
    repoQuality: number,
    reviewQuality: number,
    recency: number,
    diversityBonus: number
  ): number {
    return complexity * repoQuality * reviewQuality * recency + diversityBonus;
  }
}
