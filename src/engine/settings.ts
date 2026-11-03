import { DEFAULT_SETTINGS, type AutoStop, type Pace, type PostsPerUser, type Settings } from './types';

export const CAP_LIMITS = {
  perSession: { min: 1, max: 200, step: 5 },
  perDay: { min: 1, max: 500, step: 10 },
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
    maxLikesPerSession: clamp(
      v.maxLikesPerSession,
      CAP_LIMITS.perSession.min,
      CAP_LIMITS.perSession.max,
      d.maxLikesPerSession,
    ),
    maxLikesPerDay: clamp(v.maxLikesPerDay, CAP_LIMITS.perDay.min, CAP_LIMITS.perDay.max, d.maxLikesPerDay),
  };
}
