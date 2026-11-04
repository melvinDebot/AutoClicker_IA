// iCloud backup format: what goes to the key-value store of the Apple account and how it comes back.
// Pure (tested with Jest); src/adapters/cloudBackup.ts reads SQLite and talks to the native store.
import type { Privacy, SessionStatus, Settings, StoryResult, UserState } from './types';

export const BACKUP_VERSION = 1;
export const META_KEY = 'meta.v1';
export const SESSION_PREFIX = 'session.v1.';
/** NSUbiquitousKeyValueStore holds 1 MB in all (keys included): margin for the meta. */
export const BACKUP_BUDGET = 900_000;
/** Daily counters kept in the meta: enough for today's quota after a reinstall. */
export const DAILY_DAYS = 8;

export type BackupSession = {
  id: string;
  targetAccount: string;
  createdAt: number;
  updatedAt: number;
  status: SessionStatus;
  endReason: string | null;
  windowIndex: number;
  elapsedMs: number;
  discoveredCount: number;
  listEndReached: boolean;
  settingsJson: string;
  rulesVersion: string;
};

export type BackupUser = {
  username: string;
  firstSeenWindow: number;
  discoveredAt: number;
  state: UserState;
  privacy: Privacy;
  storyResult: StoryResult | null;
  postsResultJson: string | null;
  processedAt: number | null;
};

/** Likes per day, `YYYY-MM-DD` → [story, post]. */
export type DailyLikes = Record<string, [number, number]>;

export type BackupMeta = {
  v: number;
  savedAt: number;
  /** Null when the settings were never changed on any iPhone. */
  settings: Settings | null;
  lastWarningAt: number | null;
  daily: DailyLikes;
};

type UserTuple = [string, number, number, UserState, Privacy, StoryResult | null, string | null, number | null];

const USER_STATES: readonly UserState[] = ['todo', 'processing', 'done', 'error'];
const STATUSES: readonly SessionStatus[] = ['running', 'paused', 'done', 'interrupted'];

/** One session and its accounts, as one value (users as tuples: ~3 times smaller than objects). */
export function encodeSession(s: BackupSession, users: BackupUser[]): string {
  const u: UserTuple[] = users.map((x) => [
    x.username,
    x.firstSeenWindow,
    x.discoveredAt,
    x.state,
    x.privacy,
    x.storyResult,
    x.postsResultJson,
    x.processedAt,
  ]);
  const session: BackupSession = {
    id: s.id,
    targetAccount: s.targetAccount,
    createdAt: s.createdAt,
    updatedAt: s.updatedAt,
    status: s.status,
    endReason: s.endReason,
    windowIndex: s.windowIndex,
    elapsedMs: s.elapsedMs,
    discoveredCount: s.discoveredCount,
    listEndReached: s.listEndReached,
    settingsJson: s.settingsJson,
    rulesVersion: s.rulesVersion,
  };
  return JSON.stringify({ v: BACKUP_VERSION, s: session, u });
}

const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
const isStr = (v: unknown): v is string => typeof v === 'string';
const strOrNull = (v: unknown) => (isStr(v) ? v : null);
const numOrNull = (v: unknown) => (isNum(v) ? v : null);

/** Null for a value written by another version or damaged: it is left alone, never half imported. */
export function decodeSession(raw: string | null | undefined): { session: BackupSession; users: BackupUser[] } | null {
  if (!raw) return null;
  let v: { v?: unknown; s?: Record<string, unknown>; u?: unknown };
  try {
    v = JSON.parse(raw);
  } catch {
    return null;
  }
  const s = v?.s;
  if (v?.v !== BACKUP_VERSION || !s || !Array.isArray(v.u)) return null;
  if (!isStr(s.id) || !isStr(s.targetAccount) || !isNum(s.createdAt) || !isNum(s.updatedAt)) return null;
  if (!STATUSES.includes(s.status as SessionStatus) || !isStr(s.settingsJson) || !isStr(s.rulesVersion)) return null;
  const users: BackupUser[] = [];
  for (const t of v.u as unknown[]) {
    if (!Array.isArray(t) || !isStr(t[0]) || !isNum(t[1]) || !isNum(t[2])) return null;
    users.push({
      username: t[0],
      firstSeenWindow: t[1],
      discoveredAt: t[2],
      state: USER_STATES.includes(t[3]) ? t[3] : 'todo',
      privacy: t[4] === 'public' || t[4] === 'private' ? t[4] : 'unknown',
      storyResult: strOrNull(t[5]) as StoryResult | null,
      postsResultJson: strOrNull(t[6]),
      processedAt: numOrNull(t[7]),
    });
  }
  return {
    session: {
      id: s.id,
      targetAccount: s.targetAccount,
      createdAt: s.createdAt,
      updatedAt: s.updatedAt,
      status: s.status as SessionStatus,
      endReason: strOrNull(s.endReason),
      windowIndex: isNum(s.windowIndex) ? s.windowIndex : 0,
      elapsedMs: isNum(s.elapsedMs) ? s.elapsedMs : 0,
      discoveredCount: isNum(s.discoveredCount) ? s.discoveredCount : users.length,
      listEndReached: s.listEndReached === true,
      settingsJson: s.settingsJson,
      rulesVersion: s.rulesVersion,
    },
    users,
  };
}

export type SizedSession = { id: string; status: SessionStatus; updatedAt: number; size: number };

/**
 * Sessions that fit in the store: the ones in progress first (what must come back), then the
 * finished ones, newest first. `drop` are local sessions left out (their old copy is removed).
 */
export function pickSessions(items: SizedSession[], budget = BACKUP_BUDGET): { keep: string[]; drop: string[] } {
  const inProgress = (s: SizedSession) => (s.status === 'done' ? 1 : 0);
  const sorted = [...items].sort((a, b) => inProgress(a) - inProgress(b) || b.updatedAt - a.updatedAt);
  const keep: string[] = [];
  const drop: string[] = [];
  let used = 0;
  for (const s of sorted) {
    const size = s.size + SESSION_PREFIX.length + s.id.length;
    if (used + size <= budget) {
      keep.push(s.id);
      used += size;
    } else {
      drop.push(s.id);
    }
  }
  return { keep, drop };
}

/** A copy from iCloud replaces the local session only when it is newer, and never during a run. */
export function shouldImport(local: { updatedAt: number; status: SessionStatus } | null, remote: { updatedAt: number }): boolean {
  if (!local) return true;
  return local.status !== 'running' && remote.updatedAt > local.updatedAt;
}

/** A session saved while it ran is no longer running on this iPhone: it can be resumed. */
export function restoredStatus(status: SessionStatus): SessionStatus {
  return status === 'running' ? 'interrupted' : status;
}

/** Restored settings keep dry run on: the first run after a reinstall touches nothing until it is turned off. */
export function restoredSettings(s: Settings): Settings {
  return { ...s, dryRun: true };
}

export function parseMeta(raw: string | null | undefined): BackupMeta | null {
  if (!raw) return null;
  try {
    const v = JSON.parse(raw) as Partial<BackupMeta>;
    if (v?.v !== BACKUP_VERSION || !isNum(v.savedAt)) return null;
    const daily: DailyLikes = {};
    for (const [date, pair] of Object.entries(v.daily ?? {})) {
      if (/^\d{4}-\d{2}-\d{2}$/.test(date) && Array.isArray(pair) && isNum(pair[0]) && isNum(pair[1])) daily[date] = [pair[0], pair[1]];
    }
    return {
      v: BACKUP_VERSION,
      savedAt: v.savedAt,
      settings: v.settings && typeof v.settings === 'object' ? v.settings : null,
      lastWarningAt: numOrNull(v.lastWarningAt),
      daily,
    };
  } catch {
    return null;
  }
}

/**
 * Meta to write: this iPhone's settings when it has some, the latest Instagram warning and the
 * highest count per day of both sides, so that a cooldown or a quota is never lost by a merge.
 */
export function mergeMeta(remote: BackupMeta | null, local: Omit<BackupMeta, 'v'>): BackupMeta {
  const daily: DailyLikes = { ...(remote?.daily ?? {}) };
  for (const [date, [story, post]] of Object.entries(local.daily)) {
    const r = daily[date];
    daily[date] = r ? [Math.max(r[0], story), Math.max(r[1], post)] : [story, post];
  }
  const recent = Object.keys(daily).sort().slice(-DAILY_DAYS);
  const warnings = [remote?.lastWarningAt ?? null, local.lastWarningAt].filter(isNum);
  return {
    v: BACKUP_VERSION,
    savedAt: local.savedAt,
    settings: local.settings ?? remote?.settings ?? null,
    lastWarningAt: warnings.length ? Math.max(...warnings) : null,
    daily: Object.fromEntries(recent.map((d) => [d, daily[d]!])),
  };
}
