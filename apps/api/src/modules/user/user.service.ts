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

  async getOnboardingStatus(userId: string): Promise<boolean> {
    const user = await UserModel.findByClerkId(userId);
    return user?.onboardingComplete ?? false;
  }

  async upsertUser(githubProfile: Partial<User>): Promise<User> {
    const user = await UserModel.findOneAndUpdate(
      { githubId: githubProfile.githubId! },
      { $set: githubProfile },
      { upsert: true, new: true },
    );
    return user as unknown as User;
  }

  async savePreferences(userId: string, preferences: any, userData?: any): Promise<User> {
    const user = await UserModel.findOneAndUpdate(
      { githubId: userId },
      { 
        $set: { 
          username: userData?.username ?? '',
          displayName: userData?.fullName ?? userData?.username ?? '',
          avatarUrl: userData?.avatarUrl ?? '',
          email: userData?.email,
          skillProfile: preferences,
          onboardingComplete: true 
        } 
      },
      { upsert: true, new: true },
    );
    return user as unknown as User;
  }
}
