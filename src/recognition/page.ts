// What the page inspection script returns. Pure types, shared by the engine and its tests.
import type { Box, TargetName } from '@/engine/types';
import type { PageKind } from './url';

/** A DOM element found by the rules. `id` lets the page find it again for a tap. */
export type DomEl = {
  id: string;
  target: TargetName;
  label: string;
  text: string;
  box: Box;
  visible: boolean;
  href?: string;
};

export type ListRow = {
  username: string;
  link: DomEl;
  /** Whole row (avatar, names, follow button). */
  box: Box;
  /** Avatar box, to check the story ring on the snapshot. */
  avatar: Box | null;
  storyRing: boolean;
  fullyVisible: boolean;
};

export type Dialog = { text: string; box: Box; warning: boolean; dismiss: DomEl | null };

export type PageState = {
  url: string;
  kind: PageKind;
  username?: string;
  viewport: { w: number; h: number };
  loading: boolean;
  dialogs: Dialog[];
  /** Instagram warning visible anywhere (dialog, alert, toast): immediate stop. */
  warning: string | null;
  back: DomEl | null;
  list: null | {
    title: DomEl | null;
    rows: ListRow[];
    /** "Suggested for you" heading visible after the rows: the followers are exhausted. */
    suggestedVisible: boolean;
    scroll: { top: number; height: number; client: number };
  };
  profile: null | {
    username: string;
    privateNotice: DomEl | null;
    emptyNotice: boolean;
    /** Posts count of the header ("8 publications"), null when unreadable. */
    postsCount: number | null;
    avatar: DomEl | null;
    storyRing: boolean;
    tiles: DomEl[];
  };
  story: null | { username: string | null; like: DomEl | null; liked: boolean | null; close: DomEl | null };
  post: null | { like: DomEl | null; liked: boolean | null };
};

export type TapResult = { ok: true } | { ok: false; reason: 'stale' | 'covered' | 'offscreen'; hit?: string };
