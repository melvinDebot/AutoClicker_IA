import type { PostResult } from './types';

/** Progress over the accounts discovered so far (the total is never known in advance). */
export function progressPct(processed: number, discovered: number): number {
  if (discovered <= 0) return 0;
  return Math.min(100, Math.round((processed / discovered) * 100));
}

export function parsePostResults(json: string | null | undefined): PostResult[] {
  if (!json) return [];
  try {
    const v: unknown = JSON.parse(json);
    return Array.isArray(v) ? v.filter((x): x is PostResult => x === 'liked' || x === 'already' || x === 'error') : [];
  } catch {
    return [];
  }
}

/** 75 s → "1:15", 3 725 s → "1:02:05". */
export function formatDuration(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const pad = (n: number) => String(n).padStart(2, '0');
  return h ? `${h}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}`;
}

/** "30/10 · 14:02" (local time). */
export function formatDateTime(ts: number): string {
  const d = new Date(ts);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)} · ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** Local calendar day used by daily_counters. */
export function dayKey(ts: number): string {
  const d = new Date(ts);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
