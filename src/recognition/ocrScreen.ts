// Visual confirmation of the screen type from OCR text only (Vision on the snapshot).
// The DOM decides first; this must agree before the engine acts.
import type { Box } from '@/engine/types';
import { TEXT } from './rules';
import { normalizeText, parseCount, textMatches, textStartsLike } from './text';

/** OCR block with a box normalized to the snapshot (0…1, origin top-left). */
export type OcrBlock = { text: string; confidence: number; box: Box };

export type OcrScreen = {
  screen: 'followers_list' | 'profile' | 'unknown';
  privacy: 'public' | 'private' | null;
  /** "No posts yet" visible. */
  emptyNotice: boolean;
  /** An Instagram warning is visible: stop immediately. */
  warning: boolean;
  /** Followers count from the list tab ("12,1K followers"). */
  followersCount: number | null;
  /** Top of the "Suggested for you" block: accounts below it are not the opened profile. */
  suggestedTop: number | null;
};

const HEADER_LIMIT = 0.3; // profile counters and list tabs sit in the top 30 %

function wordIn(blocks: OcrBlock[], words: readonly string[]): OcrBlock | undefined {
  return blocks.find((b) => b.box.y < HEADER_LIMIT && textMatches(b.text, words));
}

function followersTab(blocks: OcrBlock[]): { block: OcrBlock; count: number | null } | null {
  for (const b of blocks) {
    if (b.box.y > 0.2) continue;
    const m = normalizeText(b.text).match(/^([\d][\d.,\s]*\s?[km]?)\s+(\S+)$/);
    if (m && m[1] && m[2] && textMatches(m[2], TEXT.followersWord)) return { block: b, count: parseCount(m[1]) };
  }
  return null;
}

export function classifyOcr(blocks: OcrBlock[]): OcrScreen {
  const warning = blocks.some((b) => textMatches(b.text, TEXT.warning) || textStartsLike(b.text, TEXT.warning));
  const suggested = blocks.find((b) => textMatches(b.text, TEXT.suggested) && b.box.y > 0.2);
  const base = { warning, suggestedTop: suggested ? suggested.box.y : null, emptyNotice: false, followersCount: null };

  // Followers list: "<N> followers" tab at the top and a column of follow buttons on the right.
  const tab = followersTab(blocks);
  const rightButtons = blocks.filter((b) => b.box.x > 0.6 && textMatches(b.text, TEXT.followButton)).length;
  if (tab && rightButtons >= 3) {
    return { ...base, screen: 'followers_list', privacy: null, followersCount: tab.count };
  }

  // Profile: at least two of the three counter labels in the header.
  const labels = [wordIn(blocks, TEXT.postsWord), wordIn(blocks, TEXT.followersWord), wordIn(blocks, TEXT.followingWord)];
  if (labels.filter(Boolean).length >= 2) {
    const isPrivate = blocks.some((b) => textMatches(b.text, TEXT.privateNotice));
    return {
      ...base,
      screen: 'profile',
      privacy: isPrivate ? 'private' : 'public',
      emptyNotice: blocks.some((b) => textMatches(b.text, TEXT.noPosts)),
    };
  }

  return { ...base, screen: 'unknown', privacy: null };
}
