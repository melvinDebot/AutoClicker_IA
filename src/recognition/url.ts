import { INSTAGRAM_HOSTS, NO_INJECTION_PATH_PREFIXES, RESERVED_SEGMENTS } from './rules';

export type PageKind =
  | 'login'
  | 'account_check' // challenge, 2FA, other /accounts/ pages
  | 'home'
  | 'followers'
  | 'following'
  | 'profile'
  | 'post'
  | 'story'
  | 'other'
  | 'external';

export type ParsedUrl = { kind: PageKind; username?: string };

const USERNAME = /^[A-Za-z0-9._]{1,30}$/;

function safeUrl(raw: string): URL | null {
  try {
    return new URL(raw);
  } catch {
    return null;
  }
}

export function isInstagramHost(host: string): boolean {
  return (INSTAGRAM_HOSTS as readonly string[]).includes(host.toLowerCase());
}

export function parseInstagramUrl(raw: string): ParsedUrl {
  const u = safeUrl(raw);
  if (!u || u.protocol !== 'https:' || !isInstagramHost(u.hostname)) return { kind: 'external' };
  const path = u.pathname;
  if (path.startsWith('/accounts/login') || path === '/login' || path.startsWith('/login/')) return { kind: 'login' };
  if (NO_INJECTION_PATH_PREFIXES.some((p) => path.startsWith(p))) return { kind: 'account_check' };

  const seg = path.split('/').filter(Boolean);
  const [first, second, third] = seg;
  if (!first) return { kind: 'home' };
  if (first === 'stories' && second && USERNAME.test(second)) return { kind: 'story', username: second };
  if ((first === 'p' || first === 'reel') && second) return { kind: 'post' };
  if (RESERVED_SEGMENTS.has(first) || !USERNAME.test(first)) return { kind: 'other' };
  // /<user>/p/<id>/ is also a post URL on the mobile web.
  if ((second === 'p' || second === 'reel') && third) return { kind: 'post', username: first };
  if (second === 'followers') return { kind: 'followers', username: first };
  if (second === 'following') return { kind: 'following', username: first };
  if (!second) return { kind: 'profile', username: first };
  return { kind: 'other', username: first };
}

/** Guardrail: JavaScript is only ever injected on regular Instagram pages, never on sign-in or account pages. */
export function canInject(raw: string): boolean {
  const { kind } = parseInstagramUrl(raw);
  return kind !== 'external' && kind !== 'login' && kind !== 'account_check';
}

/** Navigation policy: only http(s) loads stay in the WebView; app deep links (instagram://, itms-apps://…) are blocked. */
export function shouldLoadInWebView(raw: string): boolean {
  const u = safeUrl(raw);
  if (!u) return raw === 'about:blank';
  return u.protocol === 'https:' || u.protocol === 'http:' || raw === 'about:blank';
}

/** Short address for the WebView bar: "instagram.com/atelier.lumen/followers/". */
export function displayUrl(raw: string): string {
  const u = safeUrl(raw);
  if (!u) return raw;
  return u.hostname.replace(/^www\./, '') + (u.pathname === '/' ? '' : u.pathname);
}
