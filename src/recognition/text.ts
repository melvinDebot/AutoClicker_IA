// Text comparison tolerant to OCR misreads, observed on the screenshots:
// "followers" read as "tollowers", "sa.ina775z" as "sa.ına775z", "lyor" as "Iyor", "hslcdd" as "hsicdd".

/**
 * Lowercase, no accents, OCR look-alikes folded (dotless ı, curly quotes), single spaces.
 * NFKD also splits ligatures OCR returns as one character ("ﬁ" → "fi").
 */
export function normalizeText(s: string): string {
  return s
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/ı/g, 'i')
    .replace(/[’‘`]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

export function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  let prev = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      cur[j] = Math.min((prev[j] ?? 0) + 1, (cur[j - 1] ?? 0) + 1, (prev[j - 1] ?? 0) + cost);
    }
    prev = cur;
  }
  return prev[b.length] ?? Math.max(a.length, b.length);
}

/** About one misread character per 7, at least one from 5 characters up. */
function tolerance(len: number): number {
  return len < 5 ? 0 : Math.max(1, Math.floor(len * 0.15));
}

/** Whole-line match against any candidate. */
export function textMatches(text: string, candidates: readonly string[]): boolean {
  const t = normalizeText(text);
  return candidates.some((c) => {
    const n = normalizeText(c);
    return levenshtein(t, n) <= tolerance(n.length);
  });
}

/** Line starting like a candidate (OCR splits long sentences over several lines). */
export function textStartsLike(text: string, candidates: readonly string[]): boolean {
  const t = normalizeText(text);
  return candidates.some((c) => {
    const n = normalizeText(c);
    const len = Math.min(n.length, t.length);
    if (len < 12) return false;
    return levenshtein(t.slice(0, len), n.slice(0, len)) <= tolerance(len);
  });
}

/**
 * Username confirmation only: the exact value always comes from the DOM link.
 * Folds the letters OCR confuses (i/l/I/|, dotless ı) and runs of "_" or "." (OCR merges
 * "__" into "_"); digits stay distinct so that user00 never confirms user01.
 * Tolerance: 0 under 10 characters, 1 from 10, 2 from 20.
 */
export function usernameMatches(ocrText: string, username: string): boolean {
  const fold = (s: string) =>
    normalizeText(s)
      .replace(/^@/, '')
      .replace(/[il|]/g, 'l')
      .replace(/([_.])\1+/g, '$1');
  const n = username.length;
  if (levenshtein(fold(ocrText), fold(username)) <= (n >= 20 ? 2 : n >= 10 ? 1 : 0)) return true;
  // OCR often drops "_" and "." (drawn at the baseline) and mixes o/0, g/9, l/1 (seen: "son | of | 90d"
  // for "son____of_____god"). Second chance without separators; digits stay distinct from each other.
  const bare = (s: string) =>
    fold(s)
      .replace(/[_.\s]/g, '')
      .replace(/0/g, 'o')
      .replace(/9/g, 'g')
      .replace(/1/g, 'l');
  const b = bare(username);
  return b.length >= 6 && levenshtein(bare(ocrText), b) <= (b.length >= 12 ? 1 : 0);
}

/**
 * Truncated header ("son | _of_" for "son____of_____god"): the OCR text, without separators,
 * is the start of the username and covers at least 60 % of it. Only used to confirm a profile
 * page whose username already comes from the URL.
 */
export function usernamePrefixMatches(ocrText: string, username: string): boolean {
  const bare = (s: string) =>
    normalizeText(s)
      .replace(/^@/, '')
      .replace(/[il|1]/g, 'l')
      .replace(/[_.\s<>…]/g, '')
      .replace(/0/g, 'o')
      .replace(/9/g, 'g');
  const o = bare(ocrText);
  const u = bare(username);
  return o.length >= Math.max(4, Math.ceil(u.length * 0.6)) && u.startsWith(o);
}

/** "12,1K" → 12100, "1 634" → 1634, "1,2 M" → 1200000. Null when unreadable. */
export function parseCount(raw: string): number | null {
  const m = normalizeText(raw)
    .replace(/\s/g, '')
    .match(/^(\d+(?:[.,]\d+)?)(k|m|k\.|m\.|mil|md)?$/);
  if (!m || !m[1]) return null;
  const unit = m[2] ?? '';
  const n = Number(m[1].replace(',', '.'));
  if (!Number.isFinite(n)) return null;
  if (unit.startsWith('k') || unit === 'mil') return Math.round(n * 1_000);
  if (unit.startsWith('m')) return Math.round(n * 1_000_000);
  // Without a unit, "1,634" / "1.634" are thousands separators.
  return /^\d{1,3}[.,]\d{3}$/.test(m[1]) ? Number(m[1].replace(/[.,]/, '')) : n;
}
