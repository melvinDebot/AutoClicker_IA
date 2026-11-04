import { ADVICE, beyondAdvice, parseSettings, settingsStatus } from '../settings';
import { dayKey, formatDuration, likesText, parsePostResults, progressPct } from '../stats';
import { DEFAULT_SETTINGS } from '../types';

describe('parseSettings', () => {
  it('uses the defaults: dry run on, low caps', () => {
    expect(parseSettings(null)).toEqual(DEFAULT_SETTINGS);
    expect(DEFAULT_SETTINGS.dryRun).toBe(true);
    expect(DEFAULT_SETTINGS.maxLikesPerDay).toBe(40);
    expect(DEFAULT_SETTINGS.pace).toBe('slow');
  });

  it('the defaults follow the advice; anything beyond it is listed', () => {
    expect(beyondAdvice(DEFAULT_SETTINGS)).toEqual([]);
    expect(DEFAULT_SETTINGS.maxLikesPerDay).toBeLessThanOrEqual(ADVICE.maxPerDay);
    expect(beyondAdvice({ ...DEFAULT_SETTINGS, maxLikesPerDay: 100, pace: 'normal' })).toEqual(['100 likes par jour', 'rythme Normal']);
    expect(beyondAdvice({ ...DEFAULT_SETTINGS, pace: 'very_slow', maxLikesPerDay: 60 })).toEqual([]);
  });

  it('gives a verdict on the settings: prudent, risky, or paused after a warning', () => {
    const now = new Date(2026, 10, 3, 20, 0).getTime();
    expect(settingsStatus(DEFAULT_SETTINGS, null, now)).toEqual({
      level: 'prudent',
      title: 'Réglages prudents',
      text: '40 likes par jour en rythme Lent : dans les repères pour liker chaque jour sans avertissement (60 au plus, rythme Lent ou Très lent).',
    });
    expect(settingsStatus({ ...DEFAULT_SETTINGS, maxLikesPerDay: 100, pace: 'normal' }, null, now)).toEqual({
      level: 'risky',
      title: 'Réglages risqués',
      text: '100 likes par jour, rythme Normal : risque de « Réessayez plus tard ». Recommandé : 60 likes par jour au plus, en rythme Lent ou Très lent.',
    });
    expect(settingsStatus({ ...DEFAULT_SETTINGS, pace: 'normal' }, null, now).text).toMatch(/^Rythme Normal : risque/);
    const warned = settingsStatus(DEFAULT_SETTINGS, now - 3_600_000, now);
    expect(warned.level).toBe('blocked');
    expect(warned.text).toBe(
      'Instagram a limité le compte : aucun vrai like avant le 05/11 · 19:00. Ensuite, reprenez quelques jours avec la moitié de votre quota.',
    );
    expect(settingsStatus(DEFAULT_SETTINGS, now - 49 * 3_600_000, now).level).toBe('prudent');
  });

  it('keeps a known pace, falls back on anything else', () => {
    expect(parseSettings(JSON.stringify({ pace: 'very_slow' })).pace).toBe('very_slow');
    expect(parseSettings(JSON.stringify({ pace: 'toString' })).pace).toBe('slow');
    expect(parseSettings(JSON.stringify({ pace: 3 })).pace).toBe('slow');
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
      JSON.stringify({ postsPerUser: 7, autoStopMin: 45, maxLikesPerDay: -3 }),
    );
    expect(s.postsPerUser).toBe(DEFAULT_SETTINGS.postsPerUser);
    expect(s.autoStopMin).toBe(DEFAULT_SETTINGS.autoStopMin);
    expect(s.maxLikesPerDay).toBe(5);
    expect(parseSettings(JSON.stringify({ maxLikesPerDay: 10_000 })).maxLikesPerDay).toBe(200);
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

  it('writes like counts in French, singular and plural', () => {
    expect(likesText(1)).toBe('1 like');
    expect(likesText(5)).toBe('5 likes');
    expect(likesText(1, true)).toBe('1 like simulé');
    expect(likesText(5, true)).toBe('5 likes simulés');
  });

  it('formats durations', () => {
    expect(formatDuration(75_000)).toBe('1:15');
    expect(formatDuration(3_725_000)).toBe('1:02:05');
  });

  it('uses the local day for daily counters', () => {
    expect(dayKey(new Date(2026, 10, 2, 23, 59).getTime())).toBe('2026-11-02');
  });
});
