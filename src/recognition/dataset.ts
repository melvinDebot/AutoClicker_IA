// Format of the annotated screenshots in fixtures/screens (see its README).
import type { Box, TargetName } from '@/engine/types';
import type { OcrBlock } from './ocrScreen';

/** Elements annotated on screenshots: engine targets plus what helps avoid mistakes. */
export type AnnotationTarget =
  | TargetName
  | 'profile_username'
  | 'profile_avatar'
  | 'private_icon'
  | 'private_hint'
  | 'empty_posts_icon'
  | 'empty_posts_notice'
  | 'highlight' // "À la une": grey ring, never a story
  | 'new_badge' // "NEW" on the avatar, never a story ring
  | 'suggested_section' // accounts that are not the opened profile
  | 'loading_placeholder'; // grey skeleton: wait

export type Annotation = {
  target: AnnotationTarget;
  /** Normalized to the image (0…1, origin top-left). */
  box: Box;
  /** ocr = measured by Vision OCR; icon / manual = drawn by hand, checked on crops. */
  how: 'ocr' | 'icon' | 'manual' | 'ocr+manual';
  text?: string;
  username?: string | null;
  storyRing?: boolean;
  neverTouch?: boolean;
  partial?: boolean;
  template?: string;
  note?: string;
};

export type ScreenExpectation = {
  screen: 'followers_list' | 'profile' | 'story' | 'post' | 'unknown';
  privacy: 'public' | 'private' | null;
  loading: boolean;
  empty?: boolean;
  posts?: number;
  storyRing?: boolean;
  highlights?: number;
  postTilesVisible?: number;
  suggestedSection?: boolean;
  rowsVisible?: number;
  storyRings?: number;
  followersCount?: number;
};

export type AnnotatedScreen = {
  image: string;
  source: 'instagram-ios-app' | 'webview-iphone' | 'safari-iphone';
  device: { px: [number, number]; pt: [number, number]; scale: number };
  theme: 'dark' | 'light';
  language: 'en' | 'fr';
  note?: string;
  expect: ScreenExpectation;
  elements: Annotation[];
};

export type OcrFile = { file: string; width: number; height: number; blocks: OcrBlock[] };
