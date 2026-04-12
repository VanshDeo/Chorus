// ── User Repository (replaces Mongoose model) ───
import { eq } from 'drizzle-orm';
import { db } from '../connection';
import { users, type UserRow } from '../schema';
import type { User, SkillProfile } from '@chorus/shared-types';

// ── Type exported for service compatibility ────────────────────────────────────
export interface IUser {
  id: string;
  githubId: string;
  username: string;
  displayName: string;
  avatarUrl: string;
  email?: string;
  skillProfile?: SkillProfile;
  createdAt: Date;
  updatedAt: Date;
}

// ── Row → Domain ───────────────────────────────────────────────────────────────
function toUser(row: UserRow): IUser {
  return {
    id: row.id,
    githubId: row.githubId,
    username: row.username,
    displayName: row.displayName,
    avatarUrl: row.avatarUrl,
    email: row.email ?? undefined,
    skillProfile: (row.skillProfile as SkillProfile) ?? undefined,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

// ── UserModel (Mongoose-compatible API) ───────────────────────────────────────
export const UserModel = {
  async findById(id: string): Promise<IUser | null> {
    const [row] = await db.select().from(users).where(eq(users.id, id)).limit(1);
    return row ? toUser(row) : null;
  },

  async findOneAndUpdate(
    filter: { githubId: string },
    update: { $set: Partial<User> },
    _options: { upsert: boolean; new: boolean },
  ): Promise<IUser> {
    const data = update.$set;

    const [existing] = await db
      .select()
      .from(users)
      .where(eq(users.githubId, filter.githubId))
      .limit(1);

    if (existing) {
      const [updated] = await db
        .update(users)
        .set({
          username: data.username ?? existing.username,
          displayName: data.displayName ?? existing.displayName,
          avatarUrl: data.avatarUrl ?? existing.avatarUrl,
          email: data.email ?? existing.email,
          skillProfile: (data.skillProfile as object) ?? existing.skillProfile,
          updatedAt: new Date(),
        })
        .where(eq(users.id, existing.id))
        .returning();
      return toUser(updated);
    }

    // Upsert: insert new record
    const [inserted] = await db
      .insert(users)
      .values({
        githubId: filter.githubId,
        username: (data.username as string) ?? '',
        displayName: (data.displayName as string) ?? '',
        avatarUrl: (data.avatarUrl as string) ?? '',
        email: data.email,
        skillProfile: data.skillProfile as object,
      })
      .returning();

    return toUser(inserted);
  },
};
