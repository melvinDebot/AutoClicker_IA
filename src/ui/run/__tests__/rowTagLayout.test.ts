import type { RowTag } from '@/engine/ports';
import { placeRowTag, TAG_H, tagWidth } from '../rowTagLayout';

const row = { x: 0, y: 100, w: 364, h: 60 };
const tag = (name: RowTag['name'], button: RowTag['button'] = { x: 270, y: 114, w: 78, h: 32 }): RowTag => ({
  row,
  name,
  button,
  label: 'À traiter',
  tone: 'todo',
});

describe('placeRowTag', () => {
  it('sits right after the username text, centred on its line', () => {
    const p = placeRowTag(tag({ x: 72, y: 110, w: 60, h: 18 }), 364);
    expect(p.left).toBe(72 + 60 + 6);
    expect(p.top).toBe(110 + 9 - TAG_H / 2);
  });

  it('follows the text, not a link laid out as a wide block', () => {
    const short = placeRowTag(tag({ x: 72, y: 110, w: 40, h: 18 }), 364);
    expect(short.left).toBe(118);
  });

  it('goes under a long name instead of covering the follow button', () => {
    const p = placeRowTag(tag({ x: 72, y: 110, w: 170, h: 18 }), 364);
    expect(p.left).toBe(72);
    expect(p.top).toBe(110 + 18 + 2);
    expect(p.left + tagWidth('À traiter')).toBeLessThanOrEqual(270);
  });

  it('never leaves the WebView or the row', () => {
    const p = placeRowTag(tag({ x: 300, y: 150, w: 60, h: 18 }, null), 364);
    expect(p.left + tagWidth('À traiter')).toBeLessThanOrEqual(364);
    expect(p.top + TAG_H).toBeLessThanOrEqual(row.y + row.h);
    expect(p.top).toBeGreaterThanOrEqual(row.y);
  });
});
