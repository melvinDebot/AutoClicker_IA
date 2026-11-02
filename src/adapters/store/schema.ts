import { index, integer, primaryKey, sqliteTable, text } from 'drizzle-orm/sqlite-core';

import type { Privacy, SessionStatus, StoryResult, UserState } from '@/engine/types';

export const sessions = sqliteTable('sessions', {
  id: text('id').primaryKey(),
  targetAccount: text('target_account').notNull(),
  createdAt: integer('created_at').notNull(),
  updatedAt: integer('updated_at').notNull(),
  status: text('status').$type<SessionStatus>().notNull(),
  endReason: text('end_reason'),
  windowIndex: integer('window_index').notNull().default(0),
  elapsedMs: integer('elapsed_ms').notNull().default(0),
  /** Accounts discovered so far: grows with each scroll. */
  discoveredCount: integer('discovered_count').notNull().default(0),
  listEndReached: integer('list_end_reached', { mode: 'boolean' }).notNull().default(false),
  settingsJson: text('settings_json').notNull(),
  rulesVersion: text('rules_version').notNull(),
});

export const sessionUsers = sqliteTable(
  'session_users',
  {
    sessionId: text('session_id')
      .notNull()
      .references(() => sessions.id, { onDelete: 'cascade' }),
    username: text('username').notNull(),
    firstSeenWindow: integer('first_seen_window').notNull(),
    discoveredAt: integer('discovered_at').notNull(),
    state: text('state').$type<UserState>().notNull(),
    privacy: text('privacy').$type<Privacy>().notNull().default('unknown'),
    storyResult: text('story_result').$type<StoryResult>(),
    postsResultJson: text('posts_result_json'),
    processedAt: integer('processed_at'),
  },
  // UNIQUE(session_id, username): skips an account already visited, even when the list is reordered.
  (t) => [primaryKey({ columns: [t.sessionId, t.username] }), index('session_users_state').on(t.sessionId, t.state)],
);

export const events = sqliteTable('events', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  sessionId: text('session_id').references(() => sessions.id, { onDelete: 'cascade' }),
  at: integer('at').notNull(),
  type: text('type').notNull(),
  payloadJson: text('payload_json'),
});

export const dailyCounters = sqliteTable('daily_counters', {
  date: text('date').primaryKey(), // YYYY-MM-DD, local time
  likesStory: integer('likes_story').notNull().default(0),
  likesPost: integer('likes_post').notNull().default(0),
});

export type SessionRow = typeof sessions.$inferSelect;
export type SessionUserRow = typeof sessionUsers.$inferSelect;
