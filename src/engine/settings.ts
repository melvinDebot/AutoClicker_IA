import { DEFAULT_SETTINGS, type AutoStop, type PostsPerUser, type Settings } from './types';

export const CAP_LIMITS = {
  perSession: { min: 1, max: 200, step: 5 },
  perDay: { min: 1, max: 500, step: 10 },
} as const;

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
    postsPerUser: POSTS.includes(v.postsPerUser as PostsPerUser) ? (v.postsPerUser as PostsPerUser) : d.postsPerUser,
    autoStopMin: AUTO_STOPS.includes(v.autoStopMin as AutoStop) ? (v.autoStopMin as AutoStop) : d.autoStopMin,
    // Dry run stays on unless explicitly turned off by the user.
    dryRun: v.dryRun === false ? false : true,
    maxLikesPerSession: clamp(
      v.maxLikesPerSession,
      CAP_LIMITS.perSession.min,
      CAP_LIMITS.perSession.max,
      d.maxLikesPerSession,
    ),
    maxLikesPerDay: clamp(v.maxLikesPerDay, CAP_LIMITS.perDay.min, CAP_LIMITS.perDay.max, d.maxLikesPerDay),
  };
}
