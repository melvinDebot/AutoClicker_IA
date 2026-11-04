import { formatDateTime } from './stats';
import { DEFAULT_SETTINGS, type AutoStop, type Pace, type PostsPerUser, type Settings } from './types';

export const CAP_LIMITS = {
  perDay: { min: 5, max: 200, step: 5 },
} as const;

/**
 * Pauses (ms) drawn at random in each range: between two accounts, and on a post before its like.
 * Instagram limits the number of actions in a time window: fewer actions per hour is what lowers
 * the risk of a "Try again later", not the look of each tap.
 */
export const PACES: Record<Pace, { label: string; between: readonly [number, number]; onPost: readonly [number, number] }> = {
  normal: { label: 'Normal', between: [8_000, 20_000], onPost: [1_500, 3_500] },
  slow: { label: 'Lent', between: [20_000, 45_000], onPost: [2_000, 5_000] },
  very_slow: { label: 'Très lent', between: [45_000, 90_000], onPost: [3_000, 6_000] },
};

/** A story moves on by itself after a few seconds: only a short pause before its like. */
export const STORY_PAUSE: readonly [number, number] = [800, 2_000];

/** After an Instagram warning, no real like for this long (dry runs stay possible). */
export const WARNING_COOLDOWN_MS = 48 * 3600_000;

/**
 * Prudent routine to like every day (status card of Réglages, recap). Instagram publishes no limit:
 * these are safety margins after the "Try again later" of 2026-11-03, not a guarantee.
 */
export const ADVICE = { maxPerDay: 60 } as const;

export const ADVICE_TEXT = `Recommandé : ${ADVICE.maxPerDay} likes par jour au plus, en rythme Lent ou Très lent.`;

/** Settings beyond the advice, in a few words; empty when everything is within it. */
export function beyondAdvice(s: Settings): string[] {
  const out: string[] = [];
  if (s.maxLikesPerDay > ADVICE.maxPerDay) out.push(`${s.maxLikesPerDay} likes par jour`);
  if (s.pace === 'normal') out.push('rythme Normal');
  return out;
}

export type SettingsStatus = { level: 'blocked' | 'risky' | 'prudent'; title: string; text: string };

/** Verdict on top of Réglages: can these settings be used every day without an Instagram warning? */
export function settingsStatus(s: Settings, lastWarningAt: number | null, now: number): SettingsStatus {
  const until = cooldownUntil(lastWarningAt, now);
  if (until !== null) {
    return {
      level: 'blocked',
      title: 'Pause après un avertissement',
      text: `Instagram a limité le compte : aucun vrai like avant le ${formatDateTime(until)}. Ensuite, reprenez quelques jours avec la moitié de votre quota.`,
    };
  }
  const beyond = beyondAdvice(s).join(', ');
  if (beyond) {
    return {
      level: 'risky',
      title: 'Réglages risqués',
      text: `${beyond[0]!.toUpperCase()}${beyond.slice(1)} : risque de « Réessayez plus tard ». ${ADVICE_TEXT}`,
    };
  }
  return {
    level: 'prudent',
    title: 'Réglages prudents',
    text: `${s.maxLikesPerDay} likes par jour en rythme ${PACES[s.pace].label} : dans les repères pour liker chaque jour sans avertissement (${ADVICE.maxPerDay} au plus, rythme Lent ou Très lent).`,
  };
}

/** End of the no-real-like period after the last Instagram warning, null when it is over (or none). */
export function cooldownUntil(lastWarningAt: number | null, now: number): number | null {
  if (lastWarningAt === null) return null;
  const until = lastWarningAt + WARNING_COOLDOWN_MS;
  return now < until ? until : null;
}

/** "20 à 45 s entre deux comptes". */
export function paceRange(p: Pace): string {
  const [a, b] = PACES[p].between;
  return `${a / 1000} à ${b / 1000} s entre deux comptes`;
}

const AUTO_STOPS: readonly AutoStop[] = [0, 15, 30, 60];
const POSTS: readonly PostsPerUser[] = [0, 1, 2, 3];

const clamp = (v: unknown, min: number, max: number, fallback: number) =>
  typeof v === 'number' && Number.isFinite(v) ? Math.min(max, Math.max(min, Math.round(v))) : fallback;

/** Reads stored settings, falling back to safe defaults for anything missing or invalid. */
export function parseSettings(raw: string | null | undefined): Settings {
  let v: Record<string, unknown> = {};
  try {
    const parsed: unknown = raw ? JSON.parse(raw) : {};
    if (parsed && typeof parsed === 'object') v = parsed as Record<string, unknown>;
  } catch {
    // corrupted value: defaults
  }
  const d = DEFAULT_SETTINGS;
  return {
    likeStory: typeof v.likeStory === 'boolean' ? v.likeStory : d.likeStory,
    storyIfNoPosts: typeof v.storyIfNoPosts === 'boolean' ? v.storyIfNoPosts : d.storyIfNoPosts,
    postsPerUser: POSTS.includes(v.postsPerUser as PostsPerUser) ? (v.postsPerUser as PostsPerUser) : d.postsPerUser,
    autoStopMin: AUTO_STOPS.includes(v.autoStopMin as AutoStop) ? (v.autoStopMin as AutoStop) : d.autoStopMin,
    // Dry run stays on unless explicitly turned off by the user.
    dryRun: v.dryRun === false ? false : true,
    pace: (Object.keys(PACES) as Pace[]).includes(v.pace as Pace) ? (v.pace as Pace) : d.pace,
    maxLikesPerDay: clamp(v.maxLikesPerDay, CAP_LIMITS.perDay.min, CAP_LIMITS.perDay.max, d.maxLikesPerDay),
  };
}
