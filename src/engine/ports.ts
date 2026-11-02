// Interfaces between the pure engine and the device (WebView, Vision, SQLite, time).
// Tests implement them with a fake Instagram; the app with the real adapters.
import type { DomEl, PageState, TapResult } from '@/recognition/page';
import type { Box, PostResult, Privacy, Settings, StoryResult, TextBlock } from './types';

export type Highlight = { box: Box; label: string; tone: 'target' | 'dry' | 'done' } | null;

/** State tag drawn next to a visible row of the list during a run (data already known, no extra work). */
export type RowTag = { box: Box; label: string; tone: 'todo' | 'done' | 'next' | 'error' | 'skipped' };

export interface PagePort {
  inspect(): Promise<PageState>;
  /** Re-checks the element at its point (elementFromPoint) before the tap. */
  tap(el: DomEl): Promise<TapResult>;
  /** History back (WebView). */
  back(): Promise<void>;
  scrollList(dy: number): Promise<void>;
  /** Scrolls the page itself (profile grid below the header). */
  scrollPage(dy: number): Promise<void>;
  /** Brings the post / story heart into view. False when the page has none. */
  revealHeart(): Promise<boolean>;
  /** Development diagnostics for a row the snapshot disagrees with (optional). */
  diagnoseRow?(username: string): Promise<unknown>;
  /** Shows what the engine is about to touch (or would touch, in dry run). */
  highlight(h: Highlight): void;
  /** Tags the visible rows (to do / done / next); null hides them (not on the list). */
  tagRows(tags: RowTag[] | null): void;
}

export type SnapshotRef = { uri: string; width: number; height: number; scale: number };
export type ColorStats = { red: number; saturated: number; grey: number; dark: number; light: number; meanLuma: number };

export interface VisionPort {
  available(): boolean;
  snapshot(): Promise<SnapshotRef>;
  release(s: SnapshotRef): Promise<void>;
  ocr(s: SnapshotRef, region?: Box): Promise<TextBlock[]>;
  colors(s: SnapshotRef, region: Box, annulus?: boolean): Promise<ColorStats>;
}

export type UserRecord = { username: string; state: 'todo' | 'processing' | 'done' | 'error' };

export type UserResult = {
  state: 'done' | 'error';
  privacy: Privacy;
  story: StoryResult | null;
  posts: PostResult[];
};

export interface StorePort {
  /** Users already known for this session (resume, skip already visited). */
  loadUsers(sessionId: string): Promise<Map<string, UserRecord['state']>>;
  /** New usernames found on screen, in one transaction; returns the discovered total. */
  addUsers(sessionId: string, usernames: string[], windowIndex: number, now: number): Promise<number>;
  markProcessing(sessionId: string, username: string): Promise<void>;
  /** Back to todo (run stopped before anything was sent for this account). */
  resetUser(sessionId: string, username: string): Promise<void>;
  /** Result of one account + counters, in one transaction. */
  saveResult(
    sessionId: string,
    username: string,
    result: UserResult,
    likes: { story: number; post: number },
    now: number,
  ): Promise<void>;
  updateSession(
    sessionId: string,
    patch: Partial<{
      status: 'running' | 'paused' | 'done' | 'interrupted';
      endReason: string | null;
      windowIndex: number;
      listEndReached: boolean;
      elapsedMs: number;
    }>,
    now: number,
  ): Promise<void>;
  /** Likes already made in this session (previous runs included) and today. */
  likeCounts(sessionId: string, now: number): Promise<{ session: number; today: number }>;
  event(sessionId: string, type: string, payload: unknown, now: number): Promise<void>;
}

export interface Clock {
  now(): number;
  sleep(ms: number, signal?: AbortSignal): Promise<void>;
}

export type Ports = { page: PagePort; vision: VisionPort; store: StorePort; clock: Clock };

export type RunContext = {
  sessionId: string;
  targetAccount: string;
  settings: Settings;
  /** Elapsed time of previous runs (resume). */
  previousElapsedMs: number;
  signal: AbortSignal;
  onProgress: (p: Progress) => void;
};

export type Step =
  | 'pick_next_user'
  | 'open_profile'
  | 'classify_profile'
  | 'open_story'
  | 'like_story'
  | 'close_story'
  | 'open_post'
  | 'like_post'
  | 'back'
  | 'back_to_list'
  | 'save'
  | 'scroll'
  | 'catch_up';

export type Progress = {
  step: Step;
  text: string;
  username: string | null;
  /** Position of the current account among the discovered ones. */
  index: number;
  processed: number;
  discovered: number;
  likes: { story: number; post: number };
  /** Likes the dry run would have made. */
  dryLikes: number;
  skippedCatchUp: number;
  elapsedMs: number;
  flash?: string;
};

export type RunOutcome = { status: 'done' | 'paused'; reason: string };

export type ScanCheck = { label: string; ok: boolean };
export type ScanResult =
  | { ok: true; targetAccount: string; visibleRows: number; checks: ScanCheck[] }
  | { ok: false; message: string; checks: ScanCheck[] };
