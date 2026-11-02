// Recognition rules, versioned and saved with each session.
// URL rules (spike) and the visible texts read on the screenshots of 2026-11-02
// (Instagram iOS app, English, dark mode). DOM selectors and aria-labels come
// from the debug screen on the iPhone (step 2).

export const RULES_VERSION = '0.3.3-dom-partly-verified';
export const TEMPLATES_VERSION = '0.1.0-app-ios';

/**
 * Visible texts, French and English. Matching is tolerant to OCR misreads (see text.ts).
 * "seen": read on a screenshot (app iOS, en) — still to check in the WebView.
 * Others: to verify on the iPhone.
 */
export const TEXT = {
  // seen (en): IMG_2122, IMG_2124
  privateNotice: ['This profile is private', 'This account is private', 'Ce compte est privé', 'Ce profil est privé'],
  // seen (en), split over two lines by OCR
  privateHint: [
    'Follow this profile to see their photos and videos.',
    'Follow this account to see their photos and videos.',
    'Suivez ce compte pour voir ses photos et vidéos.',
  ],
  // seen (en): IMG_2117
  noPosts: ['No posts yet', 'Aucune publication', 'Pas encore de publications'],
  // seen (en), often read "tollowers"
  followersWord: ['followers', 'follower', 'abonnés', 'abonné(e)s', 'abonné'],
  followingWord: ['following', 'suivi(e)s', 'abonnements'],
  postsWord: ['posts', 'post', 'publications', 'publication'],
  // seen (en). Never touched: only used to locate rows.
  followButton: ['Follow', 'Follow back', 'Following', 'Requested', 'Suivre', 'Suivre en retour', 'Abonné(e)', 'Demandé'],
  // seen (en): exclusion zone, these accounts are not the opened profile
  suggested: ['Suggested for you', 'Suggestions pour vous'],
  // Instagram warnings: immediate stop (none seen yet)
  warning: [
    'Try again later',
    'Action blocked',
    'We restrict certain activity to protect our community',
    'We limit how often you can do certain things on Instagram',
    'Réessayez plus tard',
    'Action bloquée',
    'Nous limitons certaines activités pour protéger notre communauté',
    'Nous limitons la fréquence de certaines actions sur Instagram',
  ],
} as const;

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

/**
 * DOM rules (Instagram web in the WebView). Roles, aria-labels, visible texts and link
 * shapes only — never generated CSS class names. TO VERIFY on the iPhone (DOM dumps).
 */
export const DOM = {
  // aria-label of the heart <svg> (or of its button); "Unlike" when already liked.
  like: ['Like', 'J’aime', "J'aime"],
  unlike: ['Unlike', 'Je n’aime plus', "Je n'aime plus"],
  close: ['Close', 'Fermer'],
  // SEEN on the iPhone: "Back" (en), "Précédent" (fr) on the followers page.
  back: ['Back', 'Précédent', 'Retour'],
  loading: ['Loading...', 'Loading…', 'Loading', 'Chargement...', 'Chargement…', 'Chargement'],
  // Title of the followers page / dialog.
  followersTitle: ['Followers', 'Abonnés', 'Abonné(e)s'],
  // Buttons that safely close an overlay (never anything else).
  dismiss: ['Not Now', 'Not now', 'Pas maintenant', 'Plus tard'],
  // Minimum size of a like heart: comment hearts are smaller and must be ignored.
  minHeartPx: 20,
  // SEEN on the iPhone (2026-11-02, feed): avatar button aria-label "Story by <user>, not seen".
  storyPrefix: ['Story by ', 'Story de ', 'Story of '],
  storyNotSeen: [', not seen', ', non vue'],
} as const;

/** Thresholds of the visual confirmation (colorStats on the snapshot). */
export const VISUAL = {
  /** Share of red pixels in the heart box above which the heart is "filled". */
  heartRedFilled: 0.08,
  /** Story ring around an avatar: saturated (unseen, gradient) or grey (seen). */
  ringSaturated: 0.15,
  ringGrey: 0.3,
} as const;

/** Engine timings (ms). Plain waits for screens, no randomised "human" delays. */
export const TIMING = {
  poll: 350,
  screenTimeout: 9000,
  loadingTimeout: 15000,
  afterTap: 700,
  afterScroll: 900,
  /** Between two snapshot readings while a page slides in. */
  settle: 600,
} as const;
