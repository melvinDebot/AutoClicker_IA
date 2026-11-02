// Scripts injected in Instagram pages, generated from rules.ts. They read the DOM
// (roles, aria-labels, texts, link shapes; never CSS class names) and never modify it.
// Strings, because Hermes does not keep function source.
import { DOM, RESERVED_SEGMENTS, TEXT } from './rules';

/** Raw result of the inspection (the adapter adds kind/username from the URL). */
export type RawPage = Omit<import('./page').PageState, 'kind' | 'username'>;

function config() {
  return {
    like: DOM.like,
    unlike: DOM.unlike,
    close: DOM.close,
    back: DOM.back,
    loading: DOM.loading,
    followersTitle: DOM.followersTitle,
    dismiss: DOM.dismiss,
    storyPrefix: DOM.storyPrefix,
    minHeart: DOM.minHeartPx,
    privateNotice: TEXT.privateNotice,
    noPosts: TEXT.noPosts,
    suggested: TEXT.suggested,
    warning: TEXT.warning,
    reserved: [...RESERVED_SEGMENTS],
  };
}

const HELPERS = `
var vw = window.innerWidth, vh = window.innerHeight;
var reg = window.__acReg;
if (!reg || reg.map.size > 3000) reg = window.__acReg = { n: reg ? reg.n : 0, map: new Map() };
function norm(s) {
  return String(s || '').normalize('NFD').replace(/[\\u0300-\\u036f]/g, '').replace(/\\u0131/g, 'i')
    .replace(/[\\u2019\\u2018]/g, "'").replace(/\\s+/g, ' ').trim().toLowerCase();
}
function rectOf(el) { var r = el.getBoundingClientRect(); return { x: r.left, y: r.top, w: r.width, h: r.height }; }
function isVisible(el, b) {
  if (b.w < 1 || b.h < 1 || b.y + b.h <= 0 || b.x + b.w <= 0 || b.y >= vh || b.x >= vw) return false;
  var cs = window.getComputedStyle(el);
  return cs.visibility !== 'hidden' && cs.display !== 'none' && (cs.opacity === '' || Number(cs.opacity) > 0.05);
}
// Fixed or sticky bar holding an element (Instagram's bottom tab bar is a plain fixed div, not a <nav>).
function fixedAncestor(el) {
  for (var n = el, k = 0; n && n !== document.body && k < 10; n = n.parentElement, k++) {
    var pos = window.getComputedStyle(n).position;
    if (pos === 'fixed' || pos === 'sticky') return n;
  }
  return null;
}
// True when the element's centre is really on top (not under a banner, a bar or a dialog).
function uncoveredAt(el) {
  if (typeof document.elementFromPoint !== 'function') return true;
  var b = el.getBoundingClientRect();
  var hit = document.elementFromPoint(b.left + b.width / 2, b.top + b.height / 2);
  return !!hit && (hit === el || el.contains(hit) || hit.contains(el));
}
function describe(n) { return n ? n.tagName.toLowerCase() + (n.getAttribute('aria-label') ? '[' + n.getAttribute('aria-label') + ']' : '') : 'none'; }
`;

/** Inspects the current page: list rows, profile, story, post, dialogs, warnings, loading. */
export function inspectScript(): string {
  return `
var R = ${JSON.stringify(config())};
${HELPERS}
var L = {}; ['like','unlike','close','back','loading','followersTitle','dismiss','privateNotice','noPosts','suggested','warning','storyPrefix']
  .forEach(function (k) { L[k] = R[k].map(norm); });
function reg1(el, target, box) {
  var b = box || rectOf(el);
  var id = 'e' + (++reg.n);
  reg.map.set(id, new WeakRef(el));
  return { id: id, target: target, label: el.getAttribute('aria-label') || '', text: norm(el.textContent).slice(0, 120),
    box: b, visible: isVisible(el, b) };
}
function clickable(el) { return el.closest('button,[role="button"],a') || el; }
function byLabel(list) {
  var out = [], nodes = document.querySelectorAll('[aria-label]');
  for (var i = 0; i < nodes.length; i++) {
    var lab = norm(nodes[i].getAttribute('aria-label'));
    if (list.indexOf(lab) >= 0 && isVisible(nodes[i], rectOf(nodes[i]))) out.push(nodes[i]);
  }
  return out;
}
function textEls(list, maxLen) {
  var out = [], nodes = document.querySelectorAll('h1,h2,h3,span,div,a');
  for (var i = 0; i < nodes.length; i++) {
    var el = nodes[i];
    if (el.childElementCount > 3) continue;
    var t = norm(el.textContent);
    if (!t || t.length > maxLen) continue;
    for (var j = 0; j < list.length; j++) {
      if (t === list[j] || (list[j].length >= 12 && t.indexOf(list[j]) === 0)) {
        if (isVisible(el, rectOf(el))) out.push(el);
        break;
      }
    }
  }
  // Keep the innermost matches only.
  return out.filter(function (el) { return !out.some(function (o) { return o !== el && el.contains(o); }); });
}
function largest(els) {
  var best = null, area = 0;
  els.forEach(function (el) { var b = rectOf(el); if (b.w >= R.minHeart && b.w * b.h > area) { best = el; area = b.w * b.h; } });
  return best;
}
function heart() {
  var likeEl = largest(byLabel(L.like)), unlikeEl = largest(byLabel(L.unlike));
  var pick = likeEl && unlikeEl ? (rectOf(likeEl).w >= rectOf(unlikeEl).w ? likeEl : unlikeEl) : (likeEl || unlikeEl);
  if (!pick) return { like: null, liked: null };
  var liked = pick === unlikeEl;
  return { like: reg1(clickable(pick), liked ? 'like_filled' : 'like_empty', rectOf(pick)), liked: liked };
}
// Avatar button with a story: aria-label "Story by <user>, not seen" (seen on the iPhone).
function storyButton(root, user) {
  var nodes = root.querySelectorAll('[role="button"][aria-label],button[aria-label],a[aria-label]');
  for (var i = 0; i < nodes.length; i++) {
    var lab = norm(nodes[i].getAttribute('aria-label'));
    for (var j = 0; j < L.storyPrefix.length; j++) {
      var pre = L.storyPrefix[j] + ' '; // norm() trims the trailing space of the prefix
      if (lab.indexOf(user ? pre + user.toLowerCase() : pre) === 0) {
        if (isVisible(nodes[i], rectOf(nodes[i]))) return nodes[i];
      }
    }
  }
  return null;
}
// SEEN on the iPhone (fr/en): an avatar with a story is wrapped in <span role="link"> (no href)
// inside a [role="button"]; without a story it is a real <a href="/<user>/">.
function storyAvatar(img) {
  if (!img) return null;
  var l = img.closest('a[href],[role="link"]');
  if (!l || l.tagName === 'A') return null;
  return img.closest('[role="button"]') || l;
}
function containsText(el, list) { var t = norm(el.innerText || el.textContent); return list.filter(function (w) { return t.indexOf(w) >= 0; })[0] || null; }

var path = location.pathname;
var seg = path.split('/').filter(Boolean);

// Dialogs and warnings
var dialogs = [], warning = null;
var dnodes = document.querySelectorAll('[role="dialog"],[role="alertdialog"]');
for (var i = 0; i < dnodes.length; i++) {
  var d = dnodes[i], db = rectOf(d);
  if (!isVisible(d, db)) continue;
  var profileLinks = d.querySelectorAll('a[href]').length;
  if (profileLinks >= 6) continue; // the followers list itself can be a dialog
  var w = containsText(d, L.warning);
  if (w) warning = w;
  var dismiss = null, btns = d.querySelectorAll('button,[role="button"]');
  for (var j = 0; j < btns.length; j++) { if (L.dismiss.indexOf(norm(btns[j].textContent)) >= 0) { dismiss = reg1(btns[j], 'dialog'); break; } }
  dialogs.push({ text: norm(d.innerText || d.textContent).slice(0, 300), box: db, warning: !!w, dismiss: dismiss });
}
var alerts = document.querySelectorAll('[role="alert"],[role="status"],[aria-live]');
for (var i = 0; i < alerts.length; i++) { var w2 = containsText(alerts[i], L.warning); if (w2) warning = w2; }

// Loading indicators
var loading = false, lnodes = document.querySelectorAll('[role="progressbar"],[data-visualcompletion="loading-state"]');
for (var i = 0; i < lnodes.length; i++) { if (isVisible(lnodes[i], rectOf(lnodes[i]))) { loading = true; break; } }
if (!loading && byLabel(L.loading).length) loading = true;

// Back button: top-most, left-most
var backs = byLabel(L.back).map(clickable);
backs.sort(function (a, b) { var ra = rectOf(a), rb = rectOf(b); return (ra.y - rb.y) || (ra.x - rb.x); });
var back = backs.length ? reg1(backs[0], 'back_button') : null;

// Followers list
var list = null;
var titleEls = textEls(L.followersTitle, 30);
if (seg[1] === 'followers' || titleEls.length) {
  var target = (seg[0] || '').toLowerCase();
  var users = {}, order = [];
  // Rows live in <main>; links outside it (bottom tab bar with your own profile, header) are never followers.
  var mainEl = document.querySelector('main');
  var titleBottom = titleEls.length ? rectOf(titleEls[0]).y + rectOf(titleEls[0]).h : 0;
  if (backs.length) { var topBar = fixedAncestor(backs[0]); if (topBar) { var tb0 = rectOf(topBar); if (tb0.y < vh / 2) titleBottom = Math.max(titleBottom, tb0.y + tb0.h); } }
  var navs = document.querySelectorAll('nav,[role="navigation"],footer'), bottomLimit = vh;
  for (var i = 0; i < navs.length; i++) { var nb = rectOf(navs[i]); if (isVisible(navs[i], nb) && nb.y > vh / 2) bottomLimit = Math.min(bottomLimit, nb.y); }
  var anchors = document.querySelectorAll('a[href]');
  for (var i = 0; i < anchors.length; i++) {
    var a = anchors[i], p;
    try { p = new URL(a.getAttribute('href'), location.href).pathname; } catch (e) { continue; }
    var m = /^\\/([A-Za-z0-9._]{1,30})\\/?$/.exec(p);
    if (!m) continue;
    var u = m[1];
    var ab0 = rectOf(a);
    if ((mainEl && !mainEl.contains(a)) || a.closest('nav,footer,header,[role="navigation"],[role="tablist"]')) {
      var bar = fixedAncestor(a);
      if (bar && isVisible(a, ab0)) { var bb = rectOf(bar); if (bb.y > vh / 2) bottomLimit = Math.min(bottomLimit, bb.y); }
      continue;
    }
    if (R.reserved.indexOf(u.toLowerCase()) >= 0 || u.toLowerCase() === target) continue;
    if (!isVisible(a, ab0)) continue;
    if (!users[u]) { users[u] = []; order.push(u); }
    users[u].push(a);
  }
  var suggestedEls = textEls(L.suggested, 40);
  var suggestedTop = suggestedEls.length ? Math.min.apply(null, suggestedEls.map(function (e) { return rectOf(e).y; })) : Infinity;
  var rows = [], scroller = null;
  order.forEach(function (u) {
    var links = users[u], first = links[0], row = first;
    for (var k = 0; k < 8 && row.parentElement; k++) {
      var parent = row.parentElement, pb = rectOf(parent);
      var all = links.every(function (l) { return parent.contains(l); });
      row = parent;
      if (all && pb.w >= vw * 0.6 && pb.h >= 40 && pb.h <= 160) break;
    }
    var rb = rectOf(row);
    if (rb.y >= suggestedTop) return;
    var nameLink = links.filter(function (l) { return norm(l.textContent) === u.toLowerCase(); })[0] || links[links.length - 1];
    var avatarEl = row.querySelector('img') || row.querySelector('canvas');
    var ab = avatarEl ? rectOf(avatarEl) : null;
    var ring = false, canvases = row.querySelectorAll('canvas');
    for (var c = 0; c < canvases.length && ab; c++) {
      var cb = rectOf(canvases[c]);
      if (cb.x <= ab.x + ab.w / 2 && cb.x + cb.w >= ab.x + ab.w / 2 && cb.y <= ab.y + ab.h / 2 && cb.y + cb.h >= ab.y + ab.h / 2) ring = true;
    }
    var sb = storyButton(row, u) || storyAvatar(row.querySelector('img'));
    if (sb) { ring = true; ab = rectOf(sb); }
    else if (ring && canvases[0]) ab = rectOf(canvases[0]);
    // Hit test at the name: a row covered by a banner ("Use the app"…) or a bar is not fully visible.
    var nb2 = rectOf(nameLink), uncovered = true;
    if (typeof document.elementFromPoint === 'function') {
      var hit = document.elementFromPoint(nb2.x + Math.min(nb2.w / 2, 30), nb2.y + nb2.h / 2);
      uncovered = !!hit && (row === hit || row.contains(hit));
    }
    rows.push({ username: u, link: reg1(nameLink, 'user_row'), box: rb, avatar: ab, storyRing: ring,
      fullyVisible: uncovered && rb.y >= titleBottom - 1 && rb.y + rb.h <= bottomLimit + 1 });
    if (!scroller) {
      for (var s = first.parentElement; s && s !== document.body; s = s.parentElement) {
        var cs = window.getComputedStyle(s);
        if (s.scrollHeight > s.clientHeight + 5 && /(auto|scroll)/.test(cs.overflowY)) { scroller = s; break; }
      }
    }
  });
  var se = scroller || document.scrollingElement || document.documentElement;
  window.__acScroll = new WeakRef(se);
  if (rows.length || titleEls.length) {
    list = { title: titleEls.length ? reg1(titleEls[0], 'followers_list') : null, rows: rows,
      suggestedVisible: suggestedTop < vh,
      scroll: { top: se.scrollTop, height: se.scrollHeight, client: se.clientHeight } };
  }
}

// Profile
var profile = null;
if (seg.length === 1 && R.reserved.indexOf((seg[0] || '').toLowerCase()) < 0) {
  var header = document.querySelector('header') || document.querySelector('main') || document.body;
  var imgs = header.querySelectorAll('img'), avatarImg = null;
  for (var i = 0; i < imgs.length; i++) { var ib = rectOf(imgs[i]); if (ib.w >= 50 && isVisible(imgs[i], ib)) { avatarImg = imgs[i]; break; } }
  var storyRing = false, ringBox = null;
  if (avatarImg) {
    var ab2 = rectOf(avatarImg), cvs = header.querySelectorAll('canvas');
    for (var i = 0; i < cvs.length; i++) {
      var cb2 = rectOf(cvs[i]);
      if (cb2.x <= ab2.x + ab2.w / 2 && cb2.x + cb2.w >= ab2.x + ab2.w / 2 && cb2.y <= ab2.y + ab2.h / 2 && cb2.y + cb2.h >= ab2.y + ab2.h / 2) { storyRing = true; ringBox = cb2; }
    }
  }
  var profileStory = storyButton(header, seg[0]) || storyAvatar(avatarImg);
  if (profileStory) { storyRing = true; ringBox = rectOf(profileStory); }
  // "8 publications" / "1 post" in the profile header (seen on the iPhone): 0 → nothing to look for.
  var postsCount = null, cnodes = document.querySelectorAll('span,div,li');
  for (var i = 0; i < cnodes.length && postsCount === null; i++) {
    if (cnodes[i].childElementCount > 3) continue;
    var ct = norm(cnodes[i].textContent);
    var cm = /^([0-9][0-9 .,]*)\s*(k|m)?\s*(publications?|posts?)$/.exec(ct);
    if (cm) {
      var cn = Number(cm[1].replace(/[ .,]/g, ''));
      if (cm[2] === 'k') cn *= 1000; else if (cm[2] === 'm') cn *= 1000000;
      postsCount = isNaN(cn) ? null : cn;
    }
  }
  var priv = textEls(L.privateNotice, 60);
  var tiles = [], tnodes = document.querySelectorAll('a[href*="/p/"],a[href*="/reel/"]');
  for (var i = 0; i < tnodes.length; i++) {
    var t = tnodes[i], tb = rectOf(t);
    // Only tiles whose centre is free: one half under the "Use the app" banner cannot be touched.
    if (header.contains(t) || t.closest('[role="dialog"]') || tb.w < 60 || !isVisible(t, tb) || !uncoveredAt(t)) continue;
    tiles.push(t);
  }
  tiles.sort(function (a, b) { var ra = rectOf(a), rb = rectOf(b); return (Math.round(ra.y) - Math.round(rb.y)) || (ra.x - rb.x); });
  profile = { username: seg[0], privateNotice: priv.length ? reg1(priv[0], 'private_notice') : null,
    emptyNotice: textEls(L.noPosts, 40).length > 0,
    postsCount: postsCount,
    avatar: profileStory ? reg1(profileStory, 'avatar_story') : avatarImg ? reg1(clickable(avatarImg), 'avatar_story', ringBox || rectOf(avatarImg)) : null,
    storyRing: storyRing,
    tiles: tiles.slice(0, 12).map(function (t) { var e = reg1(t, 'post_tile'); e.href = new URL(t.getAttribute('href'), location.href).pathname; return e; }) };
}

// Story viewer
var story = null;
if (seg[0] === 'stories') {
  var h = heart(), closes = byLabel(L.close);
  story = { username: seg[1] || null, like: h.like, liked: h.liked, close: closes.length ? reg1(clickable(closes[0]), 'story_close') : null };
}

// Post
var post = null;
if (seg[0] === 'p' || seg[0] === 'reel' || seg[1] === 'p' || seg[1] === 'reel') {
  var h2 = heart();
  post = { like: h2.like, liked: h2.liked };
}

return { url: location.href, viewport: { w: vw, h: vh }, loading: loading, dialogs: dialogs, warning: warning,
  back: back, list: list, profile: profile, story: story, post: post };
`;
}

/** Taps an element found by `inspectScript`, after checking it is really at its point. */
export function tapScript(elementId: string): string {
  return `
${HELPERS}
var ref = reg && reg.map.get(${JSON.stringify(elementId)});
var el = ref && ref.deref();
if (!el || !el.isConnected) return { ok: false, reason: 'stale' };
var r = el.getBoundingClientRect();
var cx = r.left + r.width / 2, cy = r.top + r.height / 2;
if (cx < 0 || cy < 0 || cx > vw || cy > vh) return { ok: false, reason: 'offscreen' };
var hit = document.elementFromPoint(cx, cy);
if (!hit || !(hit === el || el.contains(hit) || hit.contains(el))) return { ok: false, reason: 'covered', hit: describe(hit) };
var base = { bubbles: true, cancelable: true, composed: true, clientX: cx, clientY: cy, view: window };
var p = Object.assign({ pointerId: 1, pointerType: 'touch', isPrimary: true }, base);
hit.dispatchEvent(new PointerEvent('pointerdown', p));
hit.dispatchEvent(new MouseEvent('mousedown', base));
hit.dispatchEvent(new PointerEvent('pointerup', p));
hit.dispatchEvent(new MouseEvent('mouseup', base));
hit.dispatchEvent(new MouseEvent('click', base));
return { ok: true };`;
}

/** DEVELOPMENT diagnostics for a row the snapshot disagrees with: copies, real visibility, hit test, scroller. */
export function diagnoseRowScript(username: string): string {
  return `
var u = ${JSON.stringify(username)};
function chain(el) {
  var out = [];
  for (var n = el, k = 0; n && n !== document.documentElement && k < 25; n = n.parentElement, k++) {
    var cs = getComputedStyle(n);
    if (Number(cs.opacity) < 1 || cs.visibility !== 'visible' || cs.display === 'none' || cs.transform !== 'none' || cs.position === 'fixed' || /(auto|scroll)/.test(cs.overflowY))
      out.push(n.tagName.toLowerCase() + '{op:' + cs.opacity + ',vis:' + cs.visibility + ',tr:' + (cs.transform === 'none' ? '-' : 'yes') + ',pos:' + cs.position + ',ov:' + cs.overflowY + ',st:' + n.scrollTop + '/' + n.scrollHeight + '}');
  }
  return out;
}
var copies = [];
document.querySelectorAll('a[href="/' + u + '/"]').forEach(function (a) {
  var r = a.getBoundingClientRect();
  var hit = document.elementFromPoint(r.left + Math.min(r.width / 2, 30), r.top + r.height / 2);
  copies.push({ y: Math.round(r.top), h: Math.round(r.height), w: Math.round(r.width), text: (a.textContent || '').slice(0, 30),
    hitInside: !!hit && (a === hit || a.contains(hit)), hit: hit ? hit.tagName.toLowerCase() + ' ' + (hit.textContent || '').slice(0, 30) : null,
    chain: chain(a) });
});
var se = document.scrollingElement;
var ref = window.__acScroll && window.__acScroll.deref();
return { url: location.pathname, docScroll: se ? se.scrollTop : null, innerScroller: ref ? ref.tagName.toLowerCase() + ' st=' + ref.scrollTop + ' sh=' + ref.scrollHeight + ' ch=' + ref.clientHeight + ' isDoc=' + (ref === se) : null,
  mains: document.querySelectorAll('main').length, copies: copies };`;
}

/** Brings the post / story heart into view (it is often below the image). Returns false if none. */
export function revealHeartScript(): string {
  return `
var R = ${JSON.stringify({ labels: [...DOM.like, ...DOM.unlike], minHeart: DOM.minHeartPx })};
${HELPERS}
var labels = R.labels.map(norm), best = null, area = 0;
var nodes = document.querySelectorAll('[aria-label]');
for (var i = 0; i < nodes.length; i++) {
  if (labels.indexOf(norm(nodes[i].getAttribute('aria-label'))) < 0) continue;
  var b = rectOf(nodes[i]);
  if (b.w >= R.minHeart && b.w * b.h > area) { best = nodes[i]; area = b.w * b.h; }
}
if (!best) return false;
best.scrollIntoView({ block: 'center', inline: 'nearest', behavior: 'auto' });
return true;`;
}

/** Scrolls the page itself (profile), not the followers list container. */
export function pageScrollScript(dy: number): string {
  return `
var se = document.scrollingElement || document.documentElement;
se.scrollBy({ top: ${Math.round(dy)}, behavior: 'auto' });
return se.scrollTop;`;
}

/** Scrolls the followers list container found by the last inspection. */
export function scrollScript(dy: number): string {
  return `
var ref = window.__acScroll, se = ref && ref.deref();
if (!se || !se.isConnected) se = document.scrollingElement || document.documentElement;
se.scrollBy({ top: ${Math.round(dy)}, behavior: 'auto' });
return se.scrollTop;`;
}
