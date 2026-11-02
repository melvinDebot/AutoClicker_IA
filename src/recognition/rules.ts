// Recognition rules, versioned and saved with each session.
// Step 1 (spike): only URL rules. Selectors, FR/EN labels and thresholds come in
// step 2, from the screenshots and from what the debug screen shows on the iPhone.

export const RULES_VERSION = '0.1.0-spike';
export const TEMPLATES_VERSION = 'none';

export const INSTAGRAM_HOSTS = ['www.instagram.com', 'instagram.com', 'm.instagram.com'] as const;
export const START_URL = 'https://www.instagram.com/';

/**
 * Paths where no JavaScript is ever injected: sign-in, account checks and
 * every account page (password, 2FA, challenge, one-tap…).
 */
export const NO_INJECTION_PATH_PREFIXES = [
  '/accounts/',
  '/challenge/',
  '/two_factor',
  '/auth_platform/',
  '/oauth/',
  '/session/',
  '/login',
  '/signup',
  '/emails/',
] as const;

/** First path segments that are not usernames. */
export const RESERVED_SEGMENTS = new Set([
  'accounts',
  'explore',
  'direct',
  'reels',
  'reel',
  'p',
  'tv',
  'stories',
  'challenge',
  'about',
  'legal',
  'developer',
  'emails',
  'web',
  'api',
  'graphql',
  'oauth',
  'session',
  'login',
  'signup',
  'two_factor',
  'auth_platform',
  'privacy',
  'terms',
  'help',
  'nametag',
  'lite',
  'your_activity',
  'notifications',
]);
