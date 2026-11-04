// iCloud backup of the sessions (accounts and progress), settings, daily counters and last Instagram
// warning, in the key-value store of the Apple account (modules/icloud-kv). After a reinstall, or on
// another iPhone signed in with the same account, the sessions in progress come back and can be resumed.
import { eq, gte, sql } from 'drizzle-orm';
import { addDatabaseChangeListener } from 'expo-sqlite';
import { Storage } from 'expo-sqlite/kv-store';
import { useSyncExternalStore } from 'react';
import { AppState } from 'react-native';

import {
  DAILY_DAYS,
  META_KEY,
  SESSION_PREFIX,
  decodeSession,
  encodeSession,
  mergeMeta,
  parseMeta,
  pickSessions,
  restoredSettings,
  restoredStatus,
  shouldImport,
  type DailyLikes,
  type SizedSession,
} from '@/engine/backup';
import { dayKey } from '@/engine/stats';
import { ICloudKV } from '../../modules/icloud-kv';
import { getSettings, hasStoredSettings, onSettingsChange, updateSettings } from './settings';
import { DB_NAME, db } from './store/db';
import { dailyCounters, events, sessions, sessionUsers } from './store/schema';
import { lastInstagramWarning } from './store/sessionStore';

const PREFS_KEY = 'cloud.v1';
/** During a run the database changes after every account: one backup per quiet period. */
const BACKUP_DELAY_MS = 5_000;
const RESTORE_DELAY_MS = 1_000;
const TABLES = new Set(['sessions', 'session_users', 'daily_counters', 'events']);

type Prefs = { enabled: boolean; lastBackupAt: number | null };

export type CloudState = Prefs & {
  /** Native module in this build (absent in Expo Go). */
  available: boolean;
  signedIn: boolean;
  /** Sessions written by the last backup, and finished ones left out for lack of room. */
  saved: number;
  left: number;
  lastRestore: { at: number; sessions: number } | null;
  error: string | null;
};

function readPrefs(): Prefs {
  try {
    const v = JSON.parse(Storage.getItemSync(PREFS_KEY) ?? 'null') as Partial<Prefs> | null;
    return { enabled: v?.enabled !== false, lastBackupAt: typeof v?.lastBackupAt === 'number' ? v.lastBackupAt : null };
  } catch {
    return { enabled: true, lastBackupAt: null };
  }
}

let state: CloudState = {
  ...readPrefs(),
  available: ICloudKV.isAvailable(),
  signedIn: ICloudKV.isSignedIn(),
  saved: 0,
  left: 0,
  lastRestore: null,
  error: null,
};
const listeners = new Set<() => void>();

function setState(patch: Partial<CloudState>) {
  state = { ...state, ...patch };
  if ('enabled' in patch || 'lastBackupAt' in patch) {
    Storage.setItemSync(PREFS_KEY, JSON.stringify({ enabled: state.enabled, lastBackupAt: state.lastBackupAt }));
  }
  listeners.forEach((l) => l());
}

export function getCloudState(): CloudState {
  return state;
}

function subscribe(l: () => void) {
  listeners.add(l);
  return () => listeners.delete(l);
}

export function useCloudState(): CloudState {
  return useSyncExternalStore(subscribe, getCloudState, getCloudState);
}

/** What the last backup wrote for each session: an unchanged session is not read again. */
const written = new Map<string, { updatedAt: number; size: number }>();
let started = false;
/** No backup before the first restore: a fresh install would write its older copy of a session over the iCloud one. */
let restored = false;
let backupTimer: ReturnType<typeof setTimeout> | null = null;
let restoreTimer: ReturnType<typeof setTimeout> | null = null;

// Backups and restores run one at a time.
let queue: Promise<unknown> = Promise.resolve();
function serial<T>(task: () => Promise<T>): Promise<T> {
  const run = queue.then(task, task);
  queue = run.catch(() => {});
  return run;
}

const fail = (e: unknown) => setState({ error: e instanceof Error ? e.message : String(e) });

async function backupNow(): Promise<void> {
  if (!state.enabled || !state.available || !restored) return;
  const rows = await db.select().from(sessions);
  const sized: SizedSession[] = [];
  const values = new Map<string, string>();
  for (const s of rows) {
    const w = written.get(s.id);
    if (w && w.updatedAt === s.updatedAt) {
      sized.push({ id: s.id, status: s.status, updatedAt: s.updatedAt, size: w.size });
      continue;
    }
    const users = await db.select().from(sessionUsers).where(eq(sessionUsers.sessionId, s.id));
    const value = encodeSession(s, users);
    values.set(s.id, value);
    sized.push({ id: s.id, status: s.status, updatedAt: s.updatedAt, size: value.length });
  }
  const { keep, drop } = pickSessions(sized);
  const updatedAt = new Map(sized.map((s) => [s.id, s.updatedAt]));
  for (const id of keep) {
    const value = values.get(id);
    if (value === undefined) continue;
    ICloudKV.set(SESSION_PREFIX + id, value);
    written.set(id, { updatedAt: updatedAt.get(id)!, size: value.length });
  }
  for (const id of drop) {
    ICloudKV.remove(SESSION_PREFIX + id);
    written.delete(id);
  }
  // Sessions of another iPhone that are not here yet stay untouched: only explicit deletions remove a copy.

  const since = dayKey(Date.now() - DAILY_DAYS * 86_400_000);
  const days = await db.select().from(dailyCounters).where(gte(dailyCounters.date, since));
  const daily: DailyLikes = Object.fromEntries(days.map((d) => [d.date, [d.likesStory, d.likesPost]]));
  const meta = mergeMeta(parseMeta(ICloudKV.get(META_KEY)), {
    savedAt: Date.now(),
    settings: hasStoredSettings() ? getSettings() : null,
    lastWarningAt: await lastInstagramWarning(),
    daily,
  });
  ICloudKV.set(META_KEY, JSON.stringify(meta));
  ICloudKV.synchronize();
  setState({ lastBackupAt: meta.savedAt, saved: keep.length, left: drop.length, signedIn: ICloudKV.isSignedIn(), error: null });
}

/** Sessions of iCloud newer than the local ones (or missing here); returns how many came back. */
async function restoreNow(): Promise<number> {
  if (!state.available) return 0;
  ICloudKV.synchronize();
  let count = 0;
  for (const key of ICloudKV.keys()) {
    if (!key.startsWith(SESSION_PREFIX)) continue;
    const raw = ICloudKV.get(key);
    const backup = decodeSession(raw);
    if (!backup) continue;
    const { session, users } = backup;
    const local = await db
      .select({ updatedAt: sessions.updatedAt, status: sessions.status })
      .from(sessions)
      .where(eq(sessions.id, session.id))
      .get();
    if (!shouldImport(local ?? null, session)) continue;
    const row = { ...session, status: restoredStatus(session.status) };
    await db.transaction(async (tx) => {
      await tx.insert(sessions).values(row).onConflictDoUpdate({ target: sessions.id, set: row });
      await tx.delete(sessionUsers).where(eq(sessionUsers.sessionId, session.id));
      // 100 rows of 9 columns: under SQLite's 999 bound parameters.
      for (let i = 0; i < users.length; i += 100) {
        await tx.insert(sessionUsers).values(users.slice(i, i + 100).map((u) => ({ ...u, sessionId: session.id })));
      }
    });
    written.set(session.id, { updatedAt: session.updatedAt, size: raw?.length ?? 0 });
    count++;
  }

  const meta = parseMeta(ICloudKV.get(META_KEY));
  if (meta) {
    // The 48 h without real likes after a warning follows the account, not the install.
    const localWarning = await lastInstagramWarning();
    if (meta.lastWarningAt !== null && (localWarning === null || meta.lastWarningAt > localWarning)) {
      await db.insert(events).values({ sessionId: null, at: meta.lastWarningAt, type: 'instagram_warning', payloadJson: JSON.stringify({ restored: 'icloud' }) });
    }
    // Highest count of both sides: the day's quota is not reset by a reinstall.
    for (const [date, [story, post]] of Object.entries(meta.daily)) {
      await db
        .insert(dailyCounters)
        .values({ date, likesStory: story, likesPost: post })
        .onConflictDoUpdate({
          target: dailyCounters.date,
          set: { likesStory: sql`max(${dailyCounters.likesStory}, ${story})`, likesPost: sql`max(${dailyCounters.likesPost}, ${post})` },
        });
    }
    if (meta.settings && !hasStoredSettings()) updateSettings(restoredSettings(meta.settings));
  }
  if (count > 0) setState({ lastRestore: { at: Date.now(), sessions: count } });
  return count;
}

function restoreOnce(): Promise<number> {
  return serial(restoreNow).finally(() => {
    restored = true;
  });
}

function scheduleBackup() {
  if (!state.enabled || !started) return;
  if (backupTimer) clearTimeout(backupTimer);
  backupTimer = setTimeout(() => {
    backupTimer = null;
    serial(backupNow).catch(fail);
  }, BACKUP_DELAY_MS);
}

function backupSoon() {
  if (backupTimer) clearTimeout(backupTimer);
  backupTimer = null;
  serial(backupNow).catch(fail);
}

/** At launch, after the migrations: restore what iCloud has, then back up after every change. */
export function startCloudBackup(): void {
  if (started || !state.available) return;
  started = true;
  ICloudKV.onChange((e) => {
    if (e.reason === 'quota') {
      setState({ error: 'Espace iCloud de l’app plein : des sessions ne sont plus sauvegardées.' });
      return;
    }
    setState({ signedIn: ICloudKV.isSignedIn() });
    // First download after an install, another iPhone, or another Apple account.
    if (!state.enabled) return;
    if (restoreTimer) clearTimeout(restoreTimer);
    restoreTimer = setTimeout(() => {
      restoreTimer = null;
      restoreOnce().catch(fail);
    }, RESTORE_DELAY_MS);
  });
  addDatabaseChangeListener((e) => {
    if (e.databaseFilePath.endsWith(DB_NAME) && TABLES.has(e.tableName)) scheduleBackup();
  });
  onSettingsChange(scheduleBackup);
  AppState.addEventListener('change', (s) => {
    if (s === 'background' && backupTimer) backupSoon();
  });
  if (!state.enabled) {
    restored = true;
    return;
  }
  restoreOnce()
    .catch(fail)
    .finally(backupSoon);
}

/** "Restaurer depuis iCloud" in Réglages. */
export function restoreFromICloud(): Promise<number> {
  return restoreOnce();
}

export async function setCloudEnabled(enabled: boolean): Promise<void> {
  setState({ enabled, error: null });
  if (enabled) {
    await restoreOnce();
    await serial(backupNow);
  } else {
    await clearICloud();
  }
}

/** A session deleted on this iPhone is deleted from iCloud too, or the next restore would bring it back. */
export function forgetSessionInICloud(id: string): void {
  if (!state.available) return;
  ICloudKV.remove(SESSION_PREFIX + id);
  written.delete(id);
}

/** "Tout effacer" and turning the backup off: nothing left on the Apple account. */
export async function clearICloud(): Promise<void> {
  if (!state.available) return;
  await serial(async () => {
    for (const key of ICloudKV.keys()) {
      if (key === META_KEY || key.startsWith(SESSION_PREFIX)) ICloudKV.remove(key);
    }
    ICloudKV.synchronize();
    written.clear();
    setState({ saved: 0, left: 0, lastBackupAt: null });
  });
}
