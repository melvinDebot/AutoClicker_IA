// Runs the OCR rules on the annotated screenshots of fixtures/screens (kept out of git).
// Skipped when the screenshots are absent. Regenerate OCR: swift tools/ocr.swift --write <images>
import fs from 'fs';
import path from 'path';

import type { AnnotatedScreen, OcrFile } from '../dataset';
import { classifyOcr } from '../ocrScreen';
import { usernameMatches } from '../text';

const ROOT = path.join(__dirname, '../../../fixtures/screens');

function walk(dir: string): string[] {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) return walk(p);
    return e.name.endsWith('.json') && !e.name.endsWith('.ocr.json') ? [p] : [];
  });
}

const cases = walk(ROOT)
  .filter((p) => fs.existsSync(p.replace(/\.json$/, '.ocr.json')))
  .map((p) => ({
    name: path.relative(ROOT, p),
    screen: JSON.parse(fs.readFileSync(p, 'utf8')) as AnnotatedScreen,
    ocr: JSON.parse(fs.readFileSync(p.replace(/\.json$/, '.ocr.json'), 'utf8')) as OcrFile,
  }));

const maybe = cases.length ? describe : describe.skip;

maybe('screenshots dataset (OCR rules)', () => {
  it.each(cases.map((c) => [c.name, c] as const))('%s: screen type and privacy', (_name, c) => {
    const r = classifyOcr(c.ocr.blocks);
    expect(r.screen).toBe(c.screen.expect.screen);
    if (c.screen.expect.screen === 'profile') expect(r.privacy).toBe(c.screen.expect.privacy);
    expect(r.warning).toBe(false);
  });

  it.each(cases.map((c) => [c.name, c] as const))('%s: "No posts yet" read when visible', (_name, c) => {
    const visible = c.screen.elements.some((e) => e.target === 'empty_posts_notice');
    expect(classifyOcr(c.ocr.blocks).emptyNotice).toBe(visible);
  });

  it.each(cases.map((c) => [c.name, c] as const))('%s: suggestions block located', (_name, c) => {
    const expected = c.screen.elements.some((e) => e.target === 'suggested_section');
    expect(classifyOcr(c.ocr.blocks).suggestedTop !== null).toBe(expected);
  });

  const lists = cases.filter((c) => c.screen.expect.screen === 'followers_list');
  it.each(lists.map((c) => [c.name, c] as const))('%s: followers count and every row username', (_name, c) => {
    expect(classifyOcr(c.ocr.blocks).followersCount).toBe(c.screen.expect.followersCount);
    const rows = c.screen.elements.filter((e) => e.target === 'user_row');
    expect(rows).toHaveLength(c.screen.expect.rowsVisible ?? rows.length);
    for (const row of rows) {
      expect(row.username).toBeTruthy();
      expect(c.ocr.blocks.some((b) => usernameMatches(b.text, row.username ?? ''))).toBe(true);
    }
    expect(rows.filter((r) => r.storyRing)).toHaveLength(c.screen.expect.storyRings ?? 0);
  });
});
