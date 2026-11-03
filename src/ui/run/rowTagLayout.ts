// Where the row tags go over the WebView. Pure, so the placement is tested without a device.
import type { RowTag } from '@/engine/ports';

export const TAG_H = 18;
const GAP = 6;
const MARGIN = 4;

/** Width of a tag (10.5 pt bold, 7 pt padding on each side), slightly generous. */
export function tagWidth(label: string): number {
  return Math.ceil(label.length * 6.6) + 14;
}

/**
 * Tag position in WebView points: right after the username, centred on its line, left of the row's
 * button and inside the WebView (`width`). No room there (long name) → under the name. Always inside the row.
 */
export function placeRowTag(t: RowTag, width: number): { left: number; top: number } {
  const w = tagWidth(t.label);
  const right = Math.min(width, t.row.x + t.row.w, t.button ? t.button.x - GAP : Number.POSITIVE_INFINITY) - MARGIN;
  const after = t.name.x + t.name.w + GAP;
  const inLine = after + w <= right;
  const left = inLine ? after : Math.max(MARGIN, Math.min(t.name.x, width - MARGIN - w));
  const top = inLine ? t.name.y + t.name.h / 2 - TAG_H / 2 : t.name.y + t.name.h + 2;
  return { left, top: Math.max(t.row.y, Math.min(top, t.row.y + t.row.h - TAG_H)) };
}
