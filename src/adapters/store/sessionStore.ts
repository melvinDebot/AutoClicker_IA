// SQLite implementation of the engine's StorePort, plus session creation and lookup.
import { and, desc, eq, inArray, sql } from 'drizzle-orm';

import type { StorePort, UserRecord, UserResult } from '@/engine/ports';
import { dayKey } from '@/engine/stats';
import type { Settings } from '@/engine/types';
import { RULES_VERSION } from '@/recognition/rules';
import { db } from './db';
import { dailyCounters, events, sessions, sessionUsers } from './schema';

function newId() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export async function createSession(targetAccount: string, settings: Settings, now = Date.now()): Promise<string> {
  const id = newId();
  await db.insert(sessions).values({
    id,
    targetAccount,
    createdAt: now,
    updatedAt: now,
    status: 'paused',
    settingsJson: JSON.stringify(settings),
    rulesVersion: RULES_VERSION,
  });
  return id;
}

/** Latest session of this account that can be resumed (paused or interrupted); the caller checks the mode. */
export async function findResumable(targetAccount: string) {
  const rows = await db
    .select()
    .from(sessions)
    .where(and(eq(sessions.targetAccount, targetAccount), inArray(sessions.status, ['paused', 'interrupted'])))
    .orderBy(desc(sessions.updatedAt))
    .limit(1);
  return rows[0] ?? null;
}

export async function getSession(id: string) {
  return (await db.select().from(sessions).where(eq(sessions.id, id)).limit(1))[0] ?? null;
}

/** At launch: a session still "running" means the app was killed during a run. */
export async function markRunningAsInterrupted(now = Date.now()): Promise<void> {
  await db
    .update(sessions)
    .set({ status: 'interrupted', endReason: 'Application fermée pendant l’exécution', updatedAt: now })
    .where(eq(sessions.status, 'running'));
}

/** New settings for a resumed session (the user may have changed them). */
export async function updateSessionSettings(id: string, settings: Settings, now = Date.now()) {
  await db.update(sessions).set({ settingsJson: JSON.stringify(settings), rulesVersion: RULES_VERSION, updatedAt: now }).where(eq(sessions.id, id));
}

export const sqliteStore: StorePort = {
  async loadUsers(sessionId) {
    const rows = await db.select({ username: sessionUsers.username, state: sessionUsers.state }).from(sessionUsers).where(eq(sessionUsers.sessionId, sessionId));
    return new Map(rows.map((r) => [r.username, r.state as UserRecord['state']]));
  },

  async addUsers(sessionId, usernames, windowIndex, now) {
    return db.transaction(async (tx) => {
      for (const username of usernames) {
        await tx
          .insert(sessionUsers)
          .values({ sessionId, username, firstSeenWindow: windowIndex, discoveredAt: now, state: 'todo' })
          .onConflictDoNothing();
      }
      const [row] = await tx.select({ n: sql<number>`count(*)` }).from(sessionUsers).where(eq(sessionUsers.sessionId, sessionId));
      const n = row?.n ?? 0;
      await tx.update(sessions).set({ discoveredCount: n, windowIndex, updatedAt: now }).where(eq(sessions.id, sessionId));
      return n;
    });
  },

  async markProcessing(sessionId, username) {
    await db.update(sessionUsers).set({ state: 'processing' }).where(and(eq(sessionUsers.sessionId, sessionId), eq(sessionUsers.username, username)));
  },

  async resetUser(sessionId, username) {
    await db
      .update(sessionUsers)
      .set({ state: 'todo', privacy: 'unknown', storyResult: null, postsResultJson: null, processedAt: null })
      .where(and(eq(sessionUsers.sessionId, sessionId), eq(sessionUsers.username, username)));
  },

  async saveResult(sessionId, username, result: UserResult, likes, now) {
    await db.transaction(async (tx) => {
      await tx
        .update(sessionUsers)
        .set({
          state: result.state,
          privacy: result.privacy,
          storyResult: result.story,
          postsResultJson: JSON.stringify(result.posts),
          processedAt: now,
        })
        .where(and(eq(sessionUsers.sessionId, sessionId), eq(sessionUsers.username, username)));
      if (likes.story + likes.post > 0) {
        await tx
          .insert(dailyCounters)
          .values({ date: dayKey(now), likesStory: likes.story, likesPost: likes.post })
          .onConflictDoUpdate({
            target: dailyCounters.date,
            set: {
              likesStory: sql`${dailyCounters.likesStory} + ${likes.story}`,
              likesPost: sql`${dailyCounters.likesPost} + ${likes.post}`,
            },
          });
      }
      await tx.update(sessions).set({ updatedAt: now }).where(eq(sessions.id, sessionId));
      await tx.insert(events).values({ sessionId, at: now, type: 'user_done', payloadJson: JSON.stringify({ username, ...result, likes }) });
    });
  },

  async updateSession(sessionId, patch, now) {
    await db.update(sessions).set({ ...patch, updatedAt: now }).where(eq(sessions.id, sessionId));
  },

  async likeCounts(sessionId, now) {
    const [s] = await db
      .select({
        n: sql<number>`(select count(*) from ${sessionUsers} su where su.session_id = ${sessionId} and su.story_result = 'liked')
          + (select count(*) from ${sessionUsers} su, json_each(coalesce(su.posts_result_json, '[]')) j where su.session_id = ${sessionId} and j.value = 'liked')`,
      })
      .from(sessions)
      .where(eq(sessions.id, sessionId));
    const day = await db.select().from(dailyCounters).where(eq(dailyCounters.date, dayKey(now))).get();
    return { session: s?.n ?? 0, today: day ? day.likesStory + day.likesPost : 0 };
  },

  async event(sessionId, type, payload, now) {
    // DEVELOPMENT ONLY: diagnostics events in the Metro console.
    if (__DEV__ && /mismatch|interrupted|warning|scroll/.test(type)) console.log(`[AC-EVENT] ${type} ${JSON.stringify(payload)}`);
    await db.insert(events).values({ sessionId, at: now, type, payloadJson: JSON.stringify(payload ?? null) });
  },
};
