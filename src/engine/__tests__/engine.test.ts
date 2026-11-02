import { Engine } from '../engine';
import type { Progress, RunContext } from '../ports';
import { FakeClock, FakeInstagram, MemoryStore, type FakeOptions, type FakeUser } from '../testing/fakeInstagram';
import { DEFAULT_SETTINGS, type Settings } from '../types';

const SID = 's1';

function users(n: number, f: (i: number) => Partial<FakeUser> = () => ({})): FakeUser[] {
  return Array.from({ length: n }, (_, i) => ({ username: `user${String(i).padStart(2, '0')}`, story: true, posts: [false, false], ...f(i) }));
}

async function run(
  list: FakeUser[],
  opts: FakeOptions = {},
  settings: Partial<Settings> = {},
  setup: (x: { ig: FakeInstagram; store: MemoryStore; ctrl: AbortController }) => void = () => {},
) {
  const ig = new FakeInstagram('atelier.lumen', list, opts);
  const store = new MemoryStore();
  const clock = new FakeClock();
  const ctrl = new AbortController();
  setup({ ig, store, ctrl });
  const progress: Progress[] = [];
  const engine = new Engine({ page: ig, vision: ig, store, clock });
  const ctx: RunContext = {
    sessionId: SID,
    targetAccount: 'atelier.lumen',
    settings: { ...DEFAULT_SETTINGS, dryRun: false, autoStopMin: 0, maxLikesPerSession: 500, maxLikesPerDay: 500, ...settings },
    previousElapsedMs: 0,
    signal: ctrl.signal,
    onProgress: (p) => progress.push(p),
  };
  const outcome = await engine.run(ctx);
  return { outcome, ig, store, progress, results: store.results(SID) };
}

const opened = (ig: FakeInstagram, u: string) => ig.taps.filter((t) => t === `row:${u}`).length;

describe('Engine — full run', () => {
  it('likes the story and N posts of every public account, then ends at the end of the list', async () => {
    const { outcome, ig, results } = await run(users(10), {}, { postsPerUser: 2 });
    expect(outcome).toEqual({ status: 'done', reason: 'Fin de la liste' });
    expect(Object.keys(results)).toHaveLength(10);
    for (const r of Object.values(results)) {
      expect(r.state).toBe('done');
      expect(r.result?.story).toBe('liked');
      expect(r.result?.posts).toEqual(['liked', 'liked']);
    }
    expect(ig.likesSent).toBe(30);
  });

  it('dry run: navigates and highlights, never sends a like', async () => {
    const { outcome, ig, results, progress } = await run(users(9), {}, { dryRun: true, postsPerUser: 1 });
    expect(outcome.status).toBe('done');
    expect(ig.likesSent).toBe(0);
    expect(ig.taps.some((t) => t.startsWith('heart'))).toBe(false);
    expect(Object.values(results).every((r) => r.result?.story === 'skipped' && r.result.posts[0] === 'skipped')).toBe(true);
    expect(progress[progress.length - 1]!.dryLikes).toBe(18);
    expect(ig.highlights.some((h) => h?.tone === 'dry')).toBe(true);
  });

  it('respects the settings: no story, zero post', async () => {
    const { ig, results } = await run(users(3), {}, { likeStory: false, postsPerUser: 0 });
    expect(ig.likesSent).toBe(0);
    expect(ig.taps.some((t) => t.startsWith('ring') || t.startsWith('tile'))).toBe(false);
    expect(Object.values(results).every((r) => r.result?.story === 'skipped')).toBe(true);
  });
});

describe('Engine — discovered list', () => {
  it('handles a list reordered on every return without visiting anyone twice', async () => {
    const { outcome, ig, results } = await run(users(20), { reorderOnReturn: true }, { postsPerUser: 0 });
    expect(outcome.status).toBe('done');
    expect(Object.keys(results)).toHaveLength(20);
    for (const u of Object.keys(results)) expect(opened(ig, u)).toBe(1);
  });

  it('adds new accounts as the list scrolls and ignores duplicates', async () => {
    const { results, progress } = await run(users(30), { initialLoaded: 7, loadStep: 7, duplicates: true }, { postsPerUser: 0, likeStory: false });
    expect(Object.keys(results)).toHaveLength(30);
    const discovered = progress.map((p) => p.discovered);
    expect(discovered[0]).toBeLessThan(30);
    expect(Math.max(...discovered)).toBe(30);
  });

  it('ends after two scrolls without any new account', async () => {
    const { outcome, ig } = await run(users(7), {}, { postsPerUser: 0, likeStory: false });
    expect(outcome).toEqual({ status: 'done', reason: 'Fin de la liste' });
    expect(ig.scrolls).toBe(2);
  });

  it('pauses (not done) when the loading never ends', async () => {
    const { outcome } = await run(users(20), { stuckLoadingAtScroll: 1 }, { postsPerUser: 0, likeStory: false });
    expect(outcome.status).toBe('paused');
    expect(outcome.reason).toMatch(/chargement bloqué/);
  });
});

describe('Engine — resume', () => {
  it('skips the accounts already handled without opening their profile', async () => {
    const list = users(25);
    const done = list.slice(0, 15).map((u) => u.username);
    const { outcome, ig, results, progress } = await run(list, {}, { postsPerUser: 0 }, ({ store }) => store.seed(SID, done));
    expect(outcome.status).toBe('done');
    for (const u of done) expect(opened(ig, u)).toBe(0);
    for (const u of list.slice(15)) expect(opened(ig, u.username)).toBe(1);
    expect(Object.keys(results)).toHaveLength(25);
    expect(progress.some((p) => /Rattrapage : 15 comptes déjà traités ignorés/.test(p.text))).toBe(true);
  });

  it('treats an account left "processing" by a crash as still to do', async () => {
    const list = users(3);
    const { results, ig } = await run(list, {}, { postsPerUser: 0 }, ({ store }) => store.seed(SID, ['user00'], 'processing'));
    expect(opened(ig, 'user00')).toBe(1);
    expect(results.user00!.state).toBe('done');
  });
});

describe('Engine — per account rules', () => {
  it('private account: nothing touched, recorded as private', async () => {
    const list = users(3, (i) => (i === 1 ? { private: true } : {}));
    const { ig, results } = await run(list, {}, { postsPerUser: 2 });
    expect(results.user01!.result?.privacy).toBe('private');
    expect(results.user01!.result?.story).toBeNull();
    expect(ig.taps.filter((t) => t.includes('user01') && !t.startsWith('row'))).toEqual([]);
  });

  it('never touches a post already liked (it would remove the like)', async () => {
    const list = users(2, () => ({ posts: [true, false] }));
    const { ig, results } = await run(list, {}, { postsPerUser: 2 });
    expect(ig.taps).not.toContain('heart-p:user00:0');
    expect(results.user00!.result?.posts).toEqual(['already', 'liked']);
  });

  it('never likes the story of another account when the viewer moved on', async () => {
    const list = users(3);
    const { ig, results } = await run(list, { storyAdvancesFor: 'user01' }, { postsPerUser: 0 });
    expect(results.user01!.result?.story).toBe('error');
    expect(ig.taps).not.toContain('heart-s:user00:extra');
    expect(ig.user('user00').storyLiked).toBe(true); // liked once, during its own visit
  });

  it('waits for a profile painted late before confirming it (page sliding in)', async () => {
    const { outcome, results } = await run(users(2), { lateProfileSnapshots: 2 }, { postsPerUser: 0 });
    expect(outcome.status).toBe('done');
    expect(results.user00!.state).toBe('done');
  });

  it('scrolls the profile to reach posts below the header', async () => {
    const { ig, results } = await run(users(2), { tilesBelowFold: true }, { postsPerUser: 2 });
    expect(results.user00!.result?.posts).toEqual(['liked', 'liked']);
    expect(ig.taps).toContain('tile:user00:1');
  });

  it('brings the post heart into view when it is below the image', async () => {
    const { results, outcome } = await run(users(2), { heartBelowFold: true }, { postsPerUser: 1, likeStory: false });
    expect(outcome.status).toBe('done');
    expect(results.user00!.result?.posts).toEqual(['liked']);
  });

  it('continues when "back" from a post lands on the list (replaced history entry)', async () => {
    const { outcome, results } = await run(users(3), { postBackSkipsProfileFor: 'user01' }, { postsPerUser: 2, likeStory: false });
    expect(outcome.status).toBe('done');
    expect(results.user01!.state).toBe('done');
    expect(results.user01!.result?.posts).toEqual(['liked']); // second post skipped, nothing touched twice
    expect(results.user02!.result?.posts).toEqual(['liked', 'liked']);
  });

  it('confirms a long profile name read in two pieces', async () => {
    const list: FakeUser[] = [{ username: 'talk_to_me__l__god_talk_to_me', posts: [] }, { username: 'user01', posts: [] }];
    const { outcome, results } = await run(list, { splitProfileNameFor: 'talk_to_me__l__god_talk_to_me' }, { postsPerUser: 0, likeStory: false });
    expect(outcome.status).toBe('done');
    expect(results['talk_to_me__l__god_talk_to_me']!.state).toBe('done');
  });

  it('closes a "Not now" window and continues', async () => {
    const { outcome, store } = await run(users(2), { dismissDialogOnce: true }, { postsPerUser: 0 });
    expect(outcome.status).toBe('done');
    expect(store.events.some((e) => e.type === 'dialog_dismissed')).toBe(true);
  });
});

describe('Engine — stops', () => {
  it('stops immediately on an Instagram warning, without retrying', async () => {
    const { outcome, ig } = await run(users(10), { warningAfterLikes: 3 }, { postsPerUser: 2 });
    expect(outcome.status).toBe('paused');
    expect(outcome.reason).toMatch(/Avertissement d’Instagram/);
    expect(ig.likesSent).toBe(3);
  });

  it('pauses on a DOM / capture disagreement before touching anything', async () => {
    const { outcome, ig } = await run(users(5), { ocrLiesFor: 'user00' });
    expect(outcome.status).toBe('paused');
    expect(outcome.reason).toMatch(/ne correspond pas au DOM/);
    expect(ig.taps).toEqual([]);
  });

  it('reads an unreadable row again after moving it up, then continues', async () => {
    const { outcome, results } = await run(users(5), { ocrGarbageUntilScrollFor: 'user00' }, { postsPerUser: 0, likeStory: false });
    expect(outcome.status).toBe('done');
    expect(results.user00!.state).toBe('done');
  });

  it('pauses when the page stops answering (connection lost)', async () => {
    const { outcome } = await run(users(10), { disconnectAfterInspects: 6 }, { postsPerUser: 0 });
    expect(outcome.status).toBe('paused');
    expect(outcome.reason).toMatch(/connexion/);
  });

  it('pauses when a like is not taken into account (DOM events ignored)', async () => {
    const { outcome, results } = await run(users(3), { ignoreLikeTaps: true });
    expect(outcome.status).toBe('paused');
    expect(outcome.reason).toMatch(/n’a pas été pris en compte/);
    expect(results.user00!.state).toBe('todo'); // nothing sent: will be retried on resume
  });

  it('stops at the session cap with exactly that many likes', async () => {
    const { outcome, ig } = await run(users(10), {}, { maxLikesPerSession: 4, postsPerUser: 2 });
    expect(outcome.status).toBe('paused');
    expect(outcome.reason).toMatch(/Plafond de la session atteint \(4 likes\)/);
    expect(ig.likesSent).toBe(4);
  });

  it('stops at the daily cap, counting likes of other sessions', async () => {
    const { outcome, ig } = await run(users(10), {}, { maxLikesPerDay: 5, postsPerUser: 2 }, ({ store }) => (store.today = 3));
    expect(outcome.reason).toMatch(/Plafond du jour atteint/);
    expect(ig.likesSent).toBe(2);
  });

  it('manual stop: paused, the account in progress goes back to todo', async () => {
    let ctrlRef: AbortController | null = null;
    const list = users(5);
    const ig0 = { opened: 0 };
    const { outcome, results } = await run(list, {}, { postsPerUser: 0, likeStory: false }, ({ ig, ctrl }) => {
      ctrlRef = ctrl;
      const tap = ig.tap.bind(ig);
      ig.tap = async (e) => {
        const r = await tap(e);
        if (e.id.startsWith('row:') && ++ig0.opened === 2) ctrlRef!.abort('manual');
        return r;
      };
    });
    expect(outcome).toEqual({ status: 'paused', reason: 'Arrêtée par vous' });
    expect(results.user00!.state).toBe('done');
    expect(results.user01!.state).toBe('todo');
  });

  it('goes back to the followers list after a pause in the middle of an account', async () => {
    const { outcome, ig } = await run(users(3), { ignoreLikeTaps: true });
    expect(outcome.status).toBe('paused');
    expect(ig.stack).toEqual([{ kind: 'followers' }]);
  });

  it('stays where it is after an Instagram warning', async () => {
    const { ig } = await run(users(10), { warningAfterLikes: 1 }, { postsPerUser: 2 });
    expect(ig.stack.length).toBeGreaterThan(1);
  });

  it('background: paused with the right reason', async () => {
    const { outcome } = await run(users(5), {}, {}, ({ ctrl }) => ctrl.abort('background'));
    expect(outcome).toEqual({ status: 'paused', reason: 'Application passée en arrière-plan' });
  });

  it('auto stop after the chosen duration', async () => {
    const { outcome } = await run(users(600), { initialLoaded: 600 }, { autoStopMin: 15, postsPerUser: 3, maxLikesPerSession: 100_000, maxLikesPerDay: 100_000 });
    expect(outcome).toEqual({ status: 'paused', reason: 'Arrêt automatique (15 min)' });
  });
});

describe('Engine — scan', () => {
  it('accepts a followers list with rows and a back button', async () => {
    const ig = new FakeInstagram('atelier.lumen', users(8));
    const r = await new Engine({ page: ig, vision: ig, store: new MemoryStore(), clock: new FakeClock() }).scan();
    expect(r).toMatchObject({ ok: true, targetAccount: 'atelier.lumen', visibleRows: 7 });
  });

  it('refuses any other screen with the expected message', async () => {
    const ig = new FakeInstagram('atelier.lumen', users(8));
    ig.stack.push({ kind: 'profile', u: 'user00' });
    const r = await new Engine({ page: ig, vision: ig, store: new MemoryStore(), clock: new FakeClock() }).scan();
    expect(r).toMatchObject({ ok: false, message: 'Ouvrez la liste des abonnés d’un compte dans la WebView.' });
  });
});
