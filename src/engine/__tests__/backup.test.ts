import {
  BACKUP_VERSION,
  DAILY_DAYS,
  decodeSession,
  encodeSession,
  mergeMeta,
  parseMeta,
  pickSessions,
  restoredSettings,
  restoredStatus,
  shouldImport,
  type BackupSession,
  type BackupUser,
} from '../backup';
import { DEFAULT_SETTINGS } from '../types';

const session: BackupSession = {
  id: 'mh2k-abc123',
  targetAccount: 'egliseicc_paris',
  createdAt: 1_000,
  updatedAt: 5_000,
  status: 'paused',
  endReason: 'Quota du jour atteint',
  windowIndex: 4,
  elapsedMs: 120_000,
  discoveredCount: 2,
  listEndReached: false,
  settingsJson: JSON.stringify(DEFAULT_SETTINGS),
  rulesVersion: '0.3.0-dom-unverified',
};

const users: BackupUser[] = [
  {
    username: 'alice',
    firstSeenWindow: 0,
    discoveredAt: 1_100,
    state: 'done',
    privacy: 'public',
    storyResult: 'liked',
    postsResultJson: '["liked","already"]',
    processedAt: 2_000,
  },
  {
    username: 'bob.b',
    firstSeenWindow: 1,
    discoveredAt: 1_200,
    state: 'todo',
    privacy: 'unknown',
    storyResult: null,
    postsResultJson: null,
    processedAt: null,
  },
];

describe('session backup', () => {
  it('round-trips a session and its accounts', () => {
    expect(decodeSession(encodeSession(session, users))).toEqual({ session, users });
  });

  it('drops extra columns of the database rows', () => {
    const row = { ...session, extra: 'x' } as BackupSession;
    const withSessionId = users.map((u) => ({ ...u, sessionId: session.id }));
    expect(decodeSession(encodeSession(row, withSessionId))).toEqual({ session, users });
  });

  it('ignores damaged values and other versions instead of importing half a session', () => {
    expect(decodeSession(null)).toBeNull();
    expect(decodeSession('{oops')).toBeNull();
    const other = JSON.parse(encodeSession(session, users));
    expect(decodeSession(JSON.stringify({ ...other, v: BACKUP_VERSION + 1 }))).toBeNull();
    expect(decodeSession(JSON.stringify({ ...other, s: { ...other.s, status: 'weird' } }))).toBeNull();
    expect(decodeSession(JSON.stringify({ ...other, u: [['alice']] }))).toBeNull();
  });

  it('keeps the sessions in progress first, then the newest finished ones, within the budget', () => {
    const items = [
      { id: 'old-done', status: 'done' as const, updatedAt: 1, size: 300 },
      { id: 'new-done', status: 'done' as const, updatedAt: 9, size: 300 },
      { id: 'paused', status: 'paused' as const, updatedAt: 2, size: 300 },
      { id: 'interrupted', status: 'interrupted' as const, updatedAt: 3, size: 300 },
    ];
    expect(pickSessions(items, 1_000)).toEqual({ keep: ['interrupted', 'paused', 'new-done'], drop: ['old-done'] });
    expect(pickSessions(items, 100)).toEqual({ keep: [], drop: ['interrupted', 'paused', 'new-done', 'old-done'] });
  });

  it('imports a missing or newer session, never over a run in progress', () => {
    expect(shouldImport(null, { updatedAt: 1 })).toBe(true);
    expect(shouldImport({ updatedAt: 1, status: 'paused' }, { updatedAt: 2 })).toBe(true);
    expect(shouldImport({ updatedAt: 2, status: 'paused' }, { updatedAt: 2 })).toBe(false);
    expect(shouldImport({ updatedAt: 1, status: 'running' }, { updatedAt: 9 })).toBe(false);
  });

  it('a restored run can be resumed, and restored settings keep dry run on', () => {
    expect(restoredStatus('running')).toBe('interrupted');
    expect(restoredStatus('paused')).toBe('paused');
    expect(restoredSettings({ ...DEFAULT_SETTINGS, dryRun: false, maxLikesPerDay: 55 })).toEqual({
      ...DEFAULT_SETTINGS,
      dryRun: true,
      maxLikesPerDay: 55,
    });
  });
});

describe('meta backup', () => {
  it('never loses a warning or a day count when merging, and keeps the recent days only', () => {
    const days = Array.from({ length: DAILY_DAYS + 2 }, (_, i) => `2026-11-${String(i + 1).padStart(2, '0')}`);
    const remote = {
      v: BACKUP_VERSION,
      savedAt: 1,
      settings: { ...DEFAULT_SETTINGS, maxLikesPerDay: 30 },
      lastWarningAt: 500,
      daily: Object.fromEntries(days.map((d) => [d, [1, 10] as [number, number]])),
    };
    const merged = mergeMeta(remote, { savedAt: 2, settings: null, lastWarningAt: 100, daily: { [days.at(-1)!]: [4, 2] } });
    expect(merged.lastWarningAt).toBe(500);
    expect(merged.settings).toEqual(remote.settings);
    expect(Object.keys(merged.daily)).toEqual(days.slice(-DAILY_DAYS));
    expect(merged.daily[days.at(-1)!]).toEqual([4, 10]);
    expect(merged.savedAt).toBe(2);
  });

  it('this iPhone’s settings win once they were changed here', () => {
    const local = { ...DEFAULT_SETTINGS, pace: 'very_slow' as const };
    expect(mergeMeta(null, { savedAt: 1, settings: local, lastWarningAt: null, daily: {} })).toEqual({
      v: BACKUP_VERSION,
      savedAt: 1,
      settings: local,
      lastWarningAt: null,
      daily: {},
    });
  });

  it('parses its own output and rejects the rest', () => {
    const meta = mergeMeta(null, { savedAt: 3, settings: DEFAULT_SETTINGS, lastWarningAt: 7, daily: { '2026-11-04': [1, 2] } });
    expect(parseMeta(JSON.stringify(meta))).toEqual(meta);
    expect(parseMeta('nope')).toBeNull();
    expect(parseMeta(JSON.stringify({ ...meta, v: 99 }))).toBeNull();
    expect(parseMeta(JSON.stringify({ ...meta, daily: { bad: [1, 2], '2026-11-05': ['x', 1] } }))?.daily).toEqual({});
  });
});
