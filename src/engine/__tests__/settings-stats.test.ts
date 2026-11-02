import { parseSettings } from '../settings';
import { dayKey, formatDuration, parsePostResults, progressPct } from '../stats';
import { DEFAULT_SETTINGS } from '../types';

describe('parseSettings', () => {
  it('uses the defaults: dry run on, low caps', () => {
    expect(parseSettings(null)).toEqual(DEFAULT_SETTINGS);
    expect(DEFAULT_SETTINGS.dryRun).toBe(true);
    expect(DEFAULT_SETTINGS.maxLikesPerSession).toBe(30);
    expect(DEFAULT_SETTINGS.maxLikesPerDay).toBe(100);
  });

  it('falls back to the defaults on corrupted data', () => {
    expect(parseSettings('{oops')).toEqual(DEFAULT_SETTINGS);
  });

  it('keeps dry run on unless explicitly false', () => {
    expect(parseSettings(JSON.stringify({ dryRun: 'no' })).dryRun).toBe(true);
    expect(parseSettings(JSON.stringify({ dryRun: false })).dryRun).toBe(false);
  });

  it('rejects out-of-range values', () => {
    const s = parseSettings(
      JSON.stringify({ postsPerUser: 7, autoStopMin: 45, maxLikesPerSession: 10_000, maxLikesPerDay: -3 }),
    );
    expect(s.postsPerUser).toBe(DEFAULT_SETTINGS.postsPerUser);
    expect(s.autoStopMin).toBe(DEFAULT_SETTINGS.autoStopMin);
    expect(s.maxLikesPerSession).toBe(200);
    expect(s.maxLikesPerDay).toBe(1);
  });
});

describe('stats', () => {
  it('progress is relative to the accounts discovered so far', () => {
    expect(progressPct(0, 0)).toBe(0);
    expect(progressPct(9, 21)).toBe(43);
    expect(progressPct(64, 64)).toBe(100);
  });

  it('parses post results defensively', () => {
    expect(parsePostResults('["liked","already","bad"]')).toEqual(['liked', 'already']);
    expect(parsePostResults('nope')).toEqual([]);
    expect(parsePostResults(null)).toEqual([]);
  });

  it('formats durations', () => {
    expect(formatDuration(75_000)).toBe('1:15');
    expect(formatDuration(3_725_000)).toBe('1:02:05');
  });

  it('uses the local day for daily counters', () => {
    expect(dayKey(new Date(2026, 10, 2, 23, 59).getTime())).toBe('2026-11-02');
  });
});
