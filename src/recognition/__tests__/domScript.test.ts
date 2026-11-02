// Runs the injected inspection script on simplified Instagram-like pages, in jsdom.
// jsdom has no layout: boxes come from data-r="x y w h". Real labels still have to be checked on the iPhone.
import { JSDOM } from 'jsdom';

import { inspectScript, scrollScript, tapScript } from '../domScript';
import type { RawPage } from '../domScript';

let dom: JSDOM;

function load(path: string, html: string) {
  dom = new JSDOM(`<!doctype html><body>${html}</body>`, { url: `https://www.instagram.com${path}`, runScripts: 'outside-only' });
  const w = dom.window;
  Object.defineProperty(w, 'innerWidth', { value: 390 });
  Object.defineProperty(w, 'innerHeight', { value: 800 });
  w.Element.prototype.getBoundingClientRect = function (this: Element) {
    const r = (this.getAttribute('data-r') ?? '').split(' ').map(Number);
    const [x = 0, y = 0, w2 = 0, h = 0] = r.length === 4 && !r.some(Number.isNaN) ? r : [0, 0, 0, 0];
    return { x, y, width: w2, height: h, left: x, top: y, right: x + w2, bottom: y + h, toJSON: () => ({}) } as DOMRect;
  };
  return w;
}

function run<T>(script: string): T {
  return dom.window.eval(`(function(){${script}\n})()`) as T;
}

function page(path: string, html: string): RawPage {
  load(path, html);
  return run<RawPage>(inspectScript());
}

const row = (u: string, y: number, story = false) => `
  <div data-r="0 ${y} 390 64">
    <a href="/${u}/" data-r="12 ${y + 8} 48 48">${story ? `<canvas data-r="10 ${y + 6} 52 52"></canvas>` : ''}<img alt="" data-r="14 ${y + 10} 44 44"></a>
    <div><a href="/${u}/" data-r="70 ${y + 12} 120 18">${u}</a><span data-r="70 ${y + 32} 120 16">Name</span></div>
    <button data-r="290 ${y + 16} 80 32">Follow</button>
  </div>`;

describe('inspectScript', () => {
  it('reads the followers list: rows, story rings, title, back; ignores nav and the target account', () => {
    const p = page(
      '/atelier.lumen/followers/',
      `<div data-r="0 0 390 60"><div role="button" data-r="4 8 40 40"><svg aria-label="Back" data-r="12 16 24 24"></svg></div>
         <span data-r="150 18 90 24">Followers</span></div>
       <div data-r="0 60 390 700">
         <a href="/atelier.lumen/" data-r="10 70 100 20">atelier.lumen</a>
         ${row('user00', 120, true)}${row('user01', 184)}${row('user02', 248)}
       </div>
       <nav data-r="0 760 390 40"><a href="/me.myself/" data-r="340 765 30 30"></a></nav>`,
    );
    expect(p.list?.rows.map((r) => r.username)).toEqual(['user00', 'user01', 'user02']);
    expect(p.list?.rows.map((r) => r.storyRing)).toEqual([true, false, false]);
    expect(p.list?.rows[0]!.box).toEqual({ x: 0, y: 120, w: 390, h: 64 });
    expect(p.list?.rows[0]!.link.box).toEqual({ x: 70, y: 132, w: 120, h: 18 });
    expect(p.list?.title?.text).toBe('followers');
    expect(p.back?.target).toBe('back_button');
    expect(p.warning).toBeNull();
    expect(p.loading).toBe(false);
  });

  it('real layout (iPhone dump): rows in <main>, own profile in the fixed bottom bar never taken as a follower', () => {
    const p = page(
      '/egliseicc_paris/followers/',
      `<div style="position: sticky" data-r="0 0 364 45"><button data-r="16 10 24 24"><svg aria-label="Back" data-r="16 10 24 24"></svg></button>
         <h1 data-r="80 13 204 18">Followers</h1></div>
       <main data-r="0 45 364 834">
         <input aria-label="Search input" data-r="16 53 332 32">
         ${row('kaji_dodi6', 101)}${row('gad_nathan', 281)}${row('nzougounsomoto', 461)}
       </main>
       <div style="position: fixed" data-r="0 440 364 50">
         <a href="/" data-r="20 441 48 48"><svg aria-label="Home" data-r="32 453 24 24"></svg></a>
         <a href="/eli_app_fr/" data-r="295 441 48 48"><img alt="eli_app_fr's profile picture" data-r="307 453 24 24"></a>
       </div>`,
    );
    expect(p.list?.rows.map((r) => r.username)).toEqual(['kaji_dodi6', 'gad_nathan', 'nzougounsomoto']);
    expect(p.list?.rows.map((r) => r.fullyVisible)).toEqual([true, true, false]); // last row is under the tab bar
    expect(p.back?.target).toBe('back_button');
  });

  it('excludes the "Suggested for you" accounts below the followers', () => {
    const p = page(
      '/atelier.lumen/followers/',
      `<span data-r="150 18 90 24">Followers</span>${row('user00', 120)}
       <h3 data-r="16 200 200 24">Suggested for you</h3>${row('suggested.one', 240)}`,
    );
    expect(p.list?.rows.map((r) => r.username)).toEqual(['user00']);
    expect(p.list?.suggestedVisible).toBe(true);
  });

  it('reads a public profile: avatar with story ring and post tiles in order', () => {
    const p = page(
      '/user00/',
      `<header data-r="0 0 390 300"><div role="button" data-r="16 80 90 90"><canvas data-r="16 80 90 90"></canvas><img alt="user00" data-r="20 84 82 82"></div></header>
       <main><a href="/p/BBB/" data-r="131 420 128 128"></a><a href="/p/AAA/" data-r="0 420 128 128"></a><a href="/reel/CCC/" data-r="0 550 128 128"></a></main>`,
    );
    expect(p.profile?.username).toBe('user00');
    expect(p.profile?.storyRing).toBe(true);
    expect(p.profile?.privateNotice).toBeNull();
    expect(p.profile?.tiles.map((t) => t.href)).toEqual(['/p/AAA/', '/p/BBB/', '/reel/CCC/']);
  });

  it('detects a story from the avatar button label seen on the iPhone ("Story by <user>, not seen")', () => {
    const p = page(
      '/user00/',
      `<header data-r="0 0 390 300"><div role="button" aria-label="Story by user00, not seen" data-r="16 80 90 90"><img alt="user00's profile picture" data-r="20 84 82 82"></div></header>`,
    );
    expect(p.profile?.storyRing).toBe(true);
    expect(p.profile?.avatar?.box).toEqual({ x: 16, y: 80, w: 90, h: 90 });
    const list = page(
      '/atelier.lumen/followers/',
      `<span data-r="150 18 90 24">Followers</span>
       <div data-r="0 120 390 64"><div role="button" aria-label="Story by user01, not seen" data-r="12 128 48 48"><img alt="" data-r="14 130 44 44"></div>
         <a href="/user01/" data-r="70 132 120 18">user01</a></div>`,
    );
    expect(list.list?.rows[0]).toMatchObject({ username: 'user01', storyRing: true });
  });

  it('reads a private profile', () => {
    const p = page(
      '/user01/',
      `<header data-r="0 0 390 300"><img alt="user01" data-r="20 84 82 82"></header>
       <main><h2 data-r="60 520 270 30">This account is private</h2></main>`,
    );
    expect(p.profile?.privateNotice?.target).toBe('private_notice');
    expect(p.profile?.storyRing).toBe(false);
    expect(p.profile?.tiles).toEqual([]);
  });

  it('reads the story heart and close button', () => {
    const p = page(
      '/stories/user00/3456/',
      `<div role="button" data-r="350 60 30 30"><svg aria-label="Close" data-r="353 63 24 24"></svg></div>
       <div role="button" data-r="336 736 40 40"><svg aria-label="Like" data-r="340 740 28 28"></svg></div>`,
    );
    expect(p.story).toMatchObject({ username: 'user00', liked: false });
    expect(p.story?.like?.target).toBe('like_empty');
    expect(p.story?.like?.box).toEqual({ x: 340, y: 740, w: 28, h: 28 });
    expect(p.story?.close?.target).toBe('story_close');
  });

  it('picks the post heart, never a small comment heart, and sees "Unlike" as liked', () => {
    const p = page(
      '/p/AAA/',
      `<div role="button" data-r="8 556 34 34"><svg aria-label="Unlike" data-r="12 560 26 26"></svg></div>
       <div role="button" data-r="350 700 16 16"><svg aria-label="Like" data-r="352 702 12 12"></svg></div>`,
    );
    expect(p.post).toMatchObject({ liked: true });
    expect(p.post?.like?.target).toBe('like_filled');
  });

  it('flags Instagram warnings and finds the safe "Not Now" button of other windows', () => {
    const warn = page('/user00/', `<div role="dialog" data-r="40 300 300 200"><h3>Try Again Later</h3><p>We restrict certain activity to protect our community.</p></div>`);
    expect(warn.warning).toBe('try again later');
    const notif = page(
      '/user00/',
      `<div role="dialog" data-r="40 300 300 200"><h3>Turn on Notifications</h3><button data-r="60 440 260 44">Not Now</button></div>`,
    );
    expect(notif.warning).toBeNull();
    expect(notif.dialogs[0]?.dismiss?.text).toBe('not now');
  });

  it('sees loading indicators', () => {
    const p = page('/atelier.lumen/followers/', `<span data-r="150 18 90 24">Followers</span>${row('user00', 120)}<svg aria-label="Loading..." data-r="180 700 30 30"></svg>`);
    expect(p.loading).toBe(true);
  });
});

describe('tap and scroll scripts', () => {
  it('refuses to tap an element covered by something else', () => {
    const p = page('/user00/', `<header data-r="0 0 390 300"><img alt="user00" data-r="20 84 82 82"></header><main><a href="/p/AAA/" data-r="0 420 128 128"></a></main>`);
    const doc = dom.window.document;
    const cover = doc.createElement('div');
    doc.body.appendChild(cover);
    doc.elementFromPoint = () => cover;
    const r = run<{ ok: boolean; reason?: string }>(tapScript(p.profile!.tiles[0]!.id));
    expect(r).toMatchObject({ ok: false, reason: 'covered' });
  });

  it('compiles the scroll script', () => {
    expect(() => new Function(scrollScript(600))).not.toThrow();
  });
});
