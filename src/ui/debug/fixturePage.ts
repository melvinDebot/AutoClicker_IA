// DEVELOPMENT ONLY: a local copy of Instagram's mobile web pages (followers list, profiles, posts,
// stories) to try the engine on the simulator without touching Instagram. Served by
// `node tools/fixture-server.mjs` (same page for every path, real navigations so that "back" works);
// likes only live in this page's sessionStorage. Same roles, aria-labels, texts and link shapes as the
// real pages read by rules.ts, including a username link laid out as a block wider than its text.
// No import: the Node server loads this file as is.

export const FIXTURE_PORT = 8099;
export const FIXTURE_TARGET = 'ac.fixture';
/** Must match DEV_FIXTURE_ORIGIN (rules.ts): the URL rules and injection guardrails apply as on Instagram. */
export const FIXTURE_URL = `http://localhost:${FIXTURE_PORT}/${FIXTURE_TARGET}/followers/`;

type FxUser = { u: string; name: string; posts: number; private?: boolean; story?: boolean };

const NAMES = ['Lina', 'Hugo', 'Maya', 'Noé', 'Inès', 'Léo', 'Jade', 'Adam', 'Louise', 'Gabriel', 'Chloé', 'Arthur'];

function users(): FxUser[] {
  const out: FxUser[] = [];
  for (let i = 0; i < 36; i++) {
    const n = String(i).padStart(2, '0');
    out.push({
      // One long name in each screen to check that its tag goes under it.
      u: i % 7 === 3 ? `ac_fx_${n}_pseudo_long` : `ac_fx_${n}`,
      name: `${NAMES[i % NAMES.length]} Fixture`,
      posts: i % 5 === 4 ? 0 : 1 + (i % 4),
      private: i % 6 === 5,
      story: i % 3 === 0,
    });
  }
  return out;
}

const CSS = `
*{box-sizing:border-box}
body{margin:0;font:14px -apple-system,system-ui,sans-serif;color:#000;background:#fff;-webkit-text-size-adjust:100%}
.top{position:sticky;top:0;height:44px;display:flex;align-items:center;justify-content:center;background:#fff;border-bottom:1px solid #dbdbdb;z-index:2}
.top button{position:absolute;left:8px;top:6px;width:32px;height:32px;border:0;background:none;font-size:26px;line-height:26px;padding:0}
.top h1{font-size:16px;margin:0;font-weight:600}
main{padding-bottom:64px}
.search{display:block;margin:8px 16px;height:36px;border-radius:8px;background:#efefef;border:0;width:calc(100% - 32px);padding:0 12px;font-size:15px}
.row{display:flex;align-items:center;height:60px;padding:0 16px;gap:12px}
.av{width:44px;height:44px;border-radius:50%;display:block}
.ring{padding:2px;border-radius:50%;background:linear-gradient(45deg,#f9ce34,#ee2a7b,#6228d7);display:block}
.ring img{border:2px solid #fff}
.names{flex:1;min-width:0}
.names a{display:block;font-weight:600;color:#000;text-decoration:none;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.names span{color:#737373;display:block}
.follow{background:#0095f6;color:#fff;border:0;border-radius:8px;height:32px;padding:0 16px;font-weight:600;font-size:14px}
.tabbar{position:fixed;bottom:0;left:0;right:0;height:50px;border-top:1px solid #dbdbdb;background:#fff;display:flex;justify-content:space-around;align-items:center;z-index:3}
.tabbar a{width:48px;height:48px;display:flex;align-items:center;justify-content:center;color:#000;text-decoration:none}
header{display:flex;align-items:center;gap:24px;padding:16px}
header ul{display:flex;gap:16px;list-style:none;margin:0;padding:0}
header li span{font-weight:600}
.big{width:86px;height:86px;border-radius:50%;display:block}
.notice{padding:40px 16px;text-align:center;font-weight:600;border-top:1px solid #dbdbdb}
.grid{display:grid;grid-template-columns:repeat(3,1fr);gap:2px;border-top:1px solid #dbdbdb}
.grid a{display:block;aspect-ratio:1}
.photo{aspect-ratio:1;width:100%}
.bar{display:flex;gap:16px;padding:8px 12px}
.bar button{border:0;background:none;padding:4px;width:40px;height:40px}
.story{position:fixed;inset:0;background:#111;color:#fff;display:flex;flex-direction:column}
.story .head{display:flex;align-items:center;justify-content:space-between;padding:16px}
.story .head button{border:0;background:none;color:#fff;font-size:28px;width:44px;height:44px}
.story .pic{flex:1;margin:0 16px;border-radius:12px}
.story .foot{display:flex;justify-content:flex-end;padding:16px}
.story .foot button{border:0;background:none;width:48px;height:48px}
`;

/** Self-contained HTML of the fake Instagram (scripts inline, images as data URIs), the same for every path. */
export function fixtureHtml(): string {
  const data = JSON.stringify({ target: FIXTURE_TARGET, users: users() });
  return `<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1">
<title>Instagram</title><style>${CSS}</style></head><body><div id="app"></div>
<script>
(function () {
  var D = ${data};
  var byName = {}; D.users.forEach(function (x) { byName[x.u] = x; });
  var liked = {};
  try { liked = JSON.parse(sessionStorage.getItem('fx-liked') || '{}'); } catch (e) {}
  // Like Instagram: every page, the followers list included, opens at the top.
  if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
  var HEART = 'M16.8 3.5c-2 0-3.7 1.1-4.8 2.8-1.1-1.7-2.8-2.8-4.8-2.8C4.4 3.5 2 5.9 2 9c0 5.6 10 11.5 10 11.5S22 14.6 22 9c0-3.1-2.4-5.5-5.2-5.5z';
  function color(s) { var h = 0; for (var i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) % 360; return 'hsl(' + h + ',55%,60%)'; }
  function avatar(u, size, cls) {
    var svg = '<svg xmlns="http://www.w3.org/2000/svg" width="' + size + '" height="' + size + '"><circle cx="' + size / 2 + '" cy="' + size / 2 + '" r="' + size / 2 + '" fill="' + color(u) + '"/></svg>';
    return '<img class="' + cls + '" alt="' + u + '\\'s profile picture" src="data:image/svg+xml,' + encodeURIComponent(svg) + '">';
  }
  function storyWrap(x, inner) {
    return x.story ? '<div role="button" aria-label="Story by ' + x.u + ', not seen"><span role="link" class="ring">' + inner + '</span></div>' : inner;
  }
  function heart(on, size) {
    return '<svg aria-label="' + (on ? 'Unlike' : 'Like') + '" role="img" width="' + size + '" height="' + size + '" viewBox="0 0 24 24"><path d="' + HEART + '" fill="' + (on ? '#ff3040' : 'none') + '" stroke="' + (on ? '#ff3040' : 'currentColor') + '" stroke-width="2"/></svg>';
  }
  var tabbar = '<div class="tabbar"><a href="/" aria-label="Home">⌂</a><a href="/explore/" aria-label="Search">⌕</a><a href="/me_fixture/" aria-label="Profile">◉</a></div>';
  var top = function (title) { return '<div class="top"><button aria-label="Back">‹</button><h1>' + title + '</h1></div>'; };

  function list() {
    var rows = D.users.map(function (x) {
      var av = storyWrap(x, x.story ? avatar(x.u, 40, 'av') : '<a href="/' + x.u + '/">' + avatar(x.u, 44, 'av') + '</a>');
      return '<div class="row">' + av + '<div class="names"><a href="/' + x.u + '/"><div><span style="color:#000;display:inline">' + x.u +
        '</span></div></a><span>' + x.name + '</span></div><button class="follow">Follow</button></div>';
    }).join('');
    return top('Followers') + '<main><input class="search" aria-label="Search input" placeholder="Search">' + rows +
      '<h3 style="padding:16px;margin:0">Suggested for you</h3></main>' + tabbar;
  }
  function profile(x) {
    var head = '<header>' + storyWrap(x, avatar(x.u, x.story ? 82 : 86, 'big')) +
      '<ul><li><span>' + x.posts + ' posts</span></li><li><span>120 followers</span></li><li><span>80 following</span></li></ul></header>';
    var body = x.private ? '<div class="notice"><span>This account is private</span></div>'
      : x.posts === 0 ? '<div class="notice"><span>No posts yet</span></div>'
      : '<div class="grid">' + Array.from({ length: x.posts }, function (_, k) {
          return '<a href="/p/' + x.u + '-' + k + '/" style="background:' + color(x.u + k) + '"></a>';
        }).join('') + '</div>';
    return top(x.u) + '<main>' + head + body + '</main>' + tabbar;
  }
  function post(id) {
    return top('Post') + '<main><div class="photo" style="background:' + color(id) + '"></div><div class="bar"><button>' + heart(!!liked[id], 24) +
      '</button></div><p style="padding:0 12px">Fixture post ' + id + '</p></main>' + tabbar;
  }
  function story(u) {
    var id = 'story:' + u;
    return '<div class="story"><div class="head"><strong>' + u + '</strong><button aria-label="Close">×</button></div><div class="pic" style="background:' +
      color(u) + '"></div><div class="foot"><button>' + heart(!!liked[id], 28) + '</button></div></div>';
  }

  function render() {
    var seg = location.pathname.split('/').filter(Boolean);
    var app = document.getElementById('app');
    if (seg[0] === 'stories' && byName[seg[1]]) app.innerHTML = story(seg[1]);
    else if (seg[0] === 'p' && seg[1]) app.innerHTML = post(seg[1]);
    else if (seg.length === 1 && byName[seg[0]]) app.innerHTML = profile(byName[seg[0]]);
    else app.innerHTML = list();
  }

  document.addEventListener('click', function (e) {
    var t = e.target instanceof Element ? e.target : null;
    if (!t) return;
    var seg = location.pathname.split('/').filter(Boolean);
    var lab = t.closest('[aria-label]');
    var label = lab ? lab.getAttribute('aria-label') : '';
    var a = t.closest('a[href]');
    // Links to the fake accounts and posts load as usual; anything else stays on the page.
    if (a && label.indexOf('Story by ') !== 0) {
      var href = a.getAttribute('href');
      if (!(byName[href.split('/').filter(Boolean)[0]] || href.indexOf('/p/') === 0)) e.preventDefault();
      return;
    }
    e.preventDefault();
    if (label === 'Back' || label === 'Close') { history.back(); return; }
    var btn = t.closest('button');
    if (btn && btn.querySelector('svg[aria-label="Like"],svg[aria-label="Unlike"]')) {
      var id = seg[0] === 'stories' ? 'story:' + seg[1] : seg[1];
      liked[id] = !liked[id];
      try { sessionStorage.setItem('fx-liked', JSON.stringify(liked)); } catch (err) {}
      render();
      return;
    }
    if (label.indexOf('Story by ') === 0) location.href = '/stories/' + label.slice(9).split(',')[0] + '/1/';
  }, true);
  // Back from the cache: same state as a fresh load (top of the page, likes of this session).
  window.addEventListener('pageshow', function () {
    try { liked = JSON.parse(sessionStorage.getItem('fx-liked') || '{}'); } catch (e) {}
    render();
    window.scrollTo(0, 0);
  });
  render();
})();
</script></body></html>`;
}
