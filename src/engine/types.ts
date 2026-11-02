// Shared types. Pure TypeScript: no React Native import allowed in src/engine.

/** In points, in the WebView coordinate space (= CSS px at zoom 1). */
export type Box = { x: number; y: number; w: number; h: number };

export type TargetName =
  | 'followers_list'
  | 'user_row'
  | 'avatar_story'
  | 'back_button'
  | 'followers_link'
  | 'private_notice'
  | 'post_tile'
  | 'like_empty'
  | 'like_filled'
  | 'story_close'
  | 'follow_button'
  | 'dialog'
  | 'warning_dialog'
  | 'spinner';

export type DomElement = { target: TargetName; label: string; text: string; box: Box; visible: boolean };
export type TextBlock = { text: string; confidence: number; box: Box };

export interface WebViewBridge {
  /** Native WKWebView snapshot; returns a temporary file URI. */
  snapshot(): Promise<string>;
  /** DOM lookup driven by rules.ts. */
  find(targets: TargetName[]): Promise<DomElement[]>;
  /** Re-checks the element at the same point before acting. */
  tap(el: DomElement): Promise<boolean>;
  scrollList(dy: number): Promise<void>;
  currentUrl(): string;
}

export interface VisionCheck {
  ocr(snapshotUri: string, region?: Box): Promise<TextBlock[]>;
  matchIcon(
    snapshotUri: string,
    region: Box,
    templates: string[],
  ): Promise<{ template: string; distance: number }[]>;
}

export type SessionStatus = 'running' | 'paused' | 'done' | 'interrupted';
export type UserState = 'todo' | 'processing' | 'done' | 'error';
export type Privacy = 'public' | 'private' | 'unknown';
export type StoryResult = 'liked' | 'already' | 'none' | 'skipped' | 'error';
/** skipped = dry run (the like was only highlighted). */
export type PostResult = 'liked' | 'already' | 'skipped' | 'error';

export type AutoStop = 0 | 15 | 30 | 60; // minutes, 0 = never
export type PostsPerUser = 0 | 1 | 2 | 3;

export type Settings = {
  likeStory: boolean;
  /** Like the story of accounts without any post, even when likeStory is off. */
  storyIfNoPosts: boolean;
  postsPerUser: PostsPerUser;
  autoStopMin: AutoStop;
  dryRun: boolean;
  maxLikesPerSession: number;
  maxLikesPerDay: number;
};

export const DEFAULT_SETTINGS: Settings = {
  likeStory: true,
  storyIfNoPosts: true,
  postsPerUser: 2,
  autoStopMin: 30,
  dryRun: true,
  maxLikesPerSession: 30,
  maxLikesPerDay: 100,
};
