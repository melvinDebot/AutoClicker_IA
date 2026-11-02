import { and, desc, eq, inArray, sql } from 'drizzle-orm';

import { dayKey } from '@/engine/stats';
import { db } from './db';
import { dailyCounters, events, sessions, sessionUsers } from './schema';

// Correlated subqueries: the session id is written fully qualified. An unqualified "id" would bind to
// json_each's own "id" column inside the posts subquery and always count 0 (seen with real likes).
const SID = sql.raw('"sessions"."id"');
const processedCount = sql<number>`(select count(*) from ${sessionUsers} su where su.session_id = ${SID} and su.state in ('done', 'error'))`;
const storyLikes = sql<number>`(select count(*) from ${sessionUsers} su where su.session_id = ${SID} and su.story_result = 'liked')`;
const postLikes = sql<number>`(select count(*) from ${sessionUsers} su, json_each(coalesce(su.posts_result_json, '[]')) j where su.session_id = ${SID} and j.value = 'liked')`;
const privateCount = sql<number>`(select count(*) from ${sessionUsers} su where su.session_id = ${SID} and su.state = 'done' and su.privacy = 'private')`;

const summaryColumns = {
  id: sessions.id,
  targetAccount: sessions.targetAccount,
  createdAt: sessions.createdAt,
  updatedAt: sessions.updatedAt,
  status: sessions.status,
  endReason: sessions.endReason,
  elapsedMs: sessions.elapsedMs,
  discoveredCount: sessions.discoveredCount,
  listEndReached: sessions.listEndReached,
  rulesVersion: sessions.rulesVersion,
  settingsJson: sessions.settingsJson,
  processed: processedCount,
  likesStory: storyLikes,
  likesPost: postLikes,
  privateCount,
};

/** Live-queryable list of sessions with their counters, newest first. */
export const sessionSummariesQuery = () => db.select(summaryColumns).from(sessions).orderBy(desc(sessions.updatedAt));

export const sessionSummaryQuery = (id: string) => db.select(summaryColumns).from(sessions).where(eq(sessions.id, id));

export type SessionSummary = Awaited<ReturnType<typeof sessionSummariesQuery>>[number];

/** Accounts already handled (or in progress) in a session, most recent first. */
export const handledUsersQuery = (sessionId: string) =>
  db
    .select()
    .from(sessionUsers)
    .where(and(eq(sessionUsers.sessionId, sessionId), inArray(sessionUsers.state, ['done', 'error', 'processing'])))
    .orderBy(desc(sessionUsers.processedAt));

export async function deleteSession(id: string): Promise<void> {
  await db.delete(sessions).where(eq(sessions.id, id));
}

/** "Tout effacer": every table. WebView data is cleared separately (native module). */
export async function wipeAllData(): Promise<void> {
  await db.transaction(async (tx) => {
    await tx.delete(events);
    await tx.delete(sessionUsers);
    await tx.delete(sessions);
    await tx.delete(dailyCounters);
  });
}

export async function likesToday(now = Date.now()): Promise<number> {
  const row = await db.select().from(dailyCounters).where(eq(dailyCounters.date, dayKey(now))).get();
  return row ? row.likesStory + row.likesPost : 0;
}
