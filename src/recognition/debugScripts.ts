// Debug-screen scripts (spike). Written as strings: Hermes does not keep function source.
// They only read the page, except `tapTestScript`, which the user triggers after a confirmation.

import type { Box } from '@/engine/types';

export type DumpElement = {
  id: string;
  tag: string;
  role: string | null;
  label: string | null;
  text: string;
  href: string | null;
  box: Box;
  visible: boolean;
};

export type DomDump = {
  url: string;
  title: string;
  viewport: { w: number; h: number; dpr: number; scrollY: number };
  elements: DumpElement[];
  truncated: boolean;
};

/**
 * Lists the elements with stable criteria (role, aria-label, links, buttons, short texts),
 * never CSS class names. Elements are kept in a page-side registry so the debug tap can find them again.
 */
export function dumpScript(onlyVisible: boolean): string {
  return `
var MAX = 400, vw = window.innerWidth, vh = window.innerHeight;
var reg = window.__acReg = { n: 0, map: new Map() };
var SEL = '[role],[aria-label],a[href],button,svg[aria-label],img[alt],h1,h2,input,textarea,[tabindex],progress';
var out = [], truncated = false;
var nodes = document.querySelectorAll(SEL);
for (var i = 0; i < nodes.length; i++) {
  var el = nodes[i];
  var r = el.getBoundingClientRect();
  if (r.width < 1 || r.height < 1) continue;
  var cs = window.getComputedStyle(el);
  var visible = cs.visibility !== 'hidden' && cs.display !== 'none' && (cs.opacity === '' || Number(cs.opacity) > 0) &&
    r.bottom > 0 && r.right > 0 && r.top < vh && r.left < vw;
  if (${onlyVisible ? 'true' : 'false'} && !visible) continue;
  if (out.length >= MAX) { truncated = true; break; }
  var id = 'e' + (++reg.n);
  reg.map.set(id, new WeakRef(el));
  var tag = el.tagName.toLowerCase();
  var label = el.getAttribute('aria-label');
  if (label === null && tag === 'img') label = el.getAttribute('alt');
  if (label === null && tag === 'svg') { var t = el.querySelector('title'); label = t ? t.textContent : null; }
  var text = el.childElementCount <= 6 ? (el.innerText || el.textContent || '').replace(/\\s+/g, ' ').trim().slice(0, 80) : '';
  var href = null;
  if (tag === 'a') { try { href = new URL(el.getAttribute('href'), location.href).pathname; } catch (e) {} }
  out.push({ id: id, tag: tag, role: el.getAttribute('role'), label: label, text: text, href: href,
    box: { x: r.left, y: r.top, w: r.width, h: r.height }, visible: visible });
}
return { url: location.href, title: document.title,
  viewport: { w: vw, h: vh, dpr: window.devicePixelRatio, scrollY: window.scrollY },
  elements: out, truncated: truncated };`;
}

export type TapTestResult =
  | { ok: true; hitTag: string; labelBefore: string | null; labelAfter: string | null }
  | { ok: false; reason: 'stale' | 'covered' | 'offscreen'; hit?: string };

/**
 * SPIKE ONLY: checks the element is really at its point (elementFromPoint), then sends the
 * pointer/mouse/click sequence a touch produces. Used to learn whether Instagram accepts
 * events triggered from the DOM (isTrusted = false).
 */
export function tapTestScript(elementId: string): string {
  return `
var ref = window.__acReg && window.__acReg.map.get(${JSON.stringify(elementId)});
var el = ref && ref.deref();
if (!el || !el.isConnected) return { ok: false, reason: 'stale' };
var r = el.getBoundingClientRect();
var cx = r.left + r.width / 2, cy = r.top + r.height / 2;
if (cx < 0 || cy < 0 || cx > window.innerWidth || cy > window.innerHeight) return { ok: false, reason: 'offscreen' };
var hit = document.elementFromPoint(cx, cy);
function describe(n) { return n ? n.tagName.toLowerCase() + (n.getAttribute('aria-label') ? '[' + n.getAttribute('aria-label') + ']' : '') : 'none'; }
if (!hit || !(hit === el || el.contains(hit) || hit.contains(el))) return { ok: false, reason: 'covered', hit: describe(hit) };
function labelOf() { var s = el.closest('[aria-label]') || el.querySelector('[aria-label]'); return s ? s.getAttribute('aria-label') : null; }
var before = labelOf();
var base = { bubbles: true, cancelable: true, composed: true, clientX: cx, clientY: cy, view: window };
var p = Object.assign({ pointerId: 1, pointerType: 'touch', isPrimary: true }, base);
hit.dispatchEvent(new PointerEvent('pointerdown', p));
hit.dispatchEvent(new MouseEvent('mousedown', base));
hit.dispatchEvent(new PointerEvent('pointerup', p));
hit.dispatchEvent(new MouseEvent('mouseup', base));
hit.dispatchEvent(new MouseEvent('click', base));
return new Promise(function (resolve) {
  setTimeout(function () { resolve({ ok: true, hitTag: describe(hit), labelBefore: before, labelAfter: labelOf() }); }, 700);
});`;
}
