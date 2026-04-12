// ── User Service ────────────────────────────────
import type { User, SkillProfile } from '@chorus/shared-types';
import { UserModel } from '../../db/models/User.model';

export class UserService {
  async getUserById(userId: string): Promise<User | null> {
    const user = await UserModel.findById(userId);
    return user as unknown as User | null;
  }

  async getSkillProfile(userId: string): Promise<SkillProfile | null> {
    const user = await UserModel.findById(userId);
    return (user?.skillProfile as unknown as SkillProfile) ?? null;
  }

  async upsertUser(githubProfile: Partial<User>): Promise<User> {
    const user = await UserModel.findOneAndUpdate(
      { githubId: githubProfile.githubId! },
      { $set: githubProfile },
      { upsert: true, new: true },
    );
    return user as unknown as User;
  }
}
