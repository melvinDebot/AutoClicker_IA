import { Engine, LIST_EMPTY } from '../engine';
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
  setup: (x: { ig: FakeInstagram; store: MemoryStore; ctrl: AbortController; clock: FakeClock }) => void = () => {},
  random: () => number = () => 0.5,
) {
  const ig = new FakeInstagram('atelier.lumen', list, opts);
  const store = new MemoryStore();
  const clock = new FakeClock();
  const ctrl = new AbortController();
  setup({ ig, store, ctrl, clock });
  const progress: Progress[] = [];
  const engine = new Engine({ page: ig, vision: ig, store, clock, random });
  const ctx: RunContext = {
    sessionId: SID,
    targetAccount: 'atelier.lumen',
    settings: { ...DEFAULT_SETTINGS, dryRun: false, autoStopMin: 0, maxLikesPerSession: 500, maxLikesPerDay: 500, ...settings },
    previousElapsedMs: 0,
    signal: ctrl.signal,
    onProgress: (p) => progress.push(p),
  };
  const outcome = await engine.run(ctx);
  return { outcome, ig, store, clock, progress, results: store.results(SID) };
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

  it('tags the visible rows: next, to do, done', async () => {
    const { ig } = await run(users(9), {}, { postsPerUser: 0, likeStory: false });
    const first = ig.rowTags.find((t) => t && t.length > 0)!;
    expect(first[0]!.label).toBe('Suivant');
    expect(first.slice(1).every((t) => t.label === 'À traiter')).toBe(true);
    const later = ig.rowTags.find((t) => t?.[3]?.label === 'Suivant')!;
    expect(later.filter((t) => t.label === 'Ignoré').length).toBe(3); // nothing to like (0 post, no story)
    expect(ig.rowTags[ig.rowTags.length - 1]).toBeNull(); // hidden at the end
  });

  it('tags "Liké" only when a like was really sent, "Simulé" in dry run', async () => {
    const real = await run(users(4), {}, { postsPerUser: 1, likeStory: false });
    const realTags = real.ig.rowTags.filter((t): t is NonNullable<typeof t> => !!t && t.length > 0).pop()!;
    expect(realTags.filter((t) => t.label === 'Liké').length).toBeGreaterThan(0);
    const dry = await run(users(4), {}, { postsPerUser: 1, likeStory: false, dryRun: true });
    const dryTags = dry.ig.rowTags.filter((t): t is NonNullable<typeof t> => !!t && t.length > 0).pop()!;
    expect(dryTags.some((t) => t.label === 'Liké')).toBe(false);
    expect(dryTags.filter((t) => t.label === 'Simulé').length).toBeGreaterThan(0);
  });

  it('likes the story of accounts without any post when the fallback is on', async () => {
    const list = users(3, (i) => (i === 1 ? { posts: [], story: true } : { story: true }));
    const { results } = await run(list, {}, { likeStory: false, storyIfNoPosts: true, postsPerUser: 2 });
    expect(results.user01!.result?.story).toBe('liked');
    expect(results.user00!.result?.story).toBe('skipped'); // has posts: posts only
    expect(results.user00!.result?.posts).toEqual(['liked', 'liked']);
  });

  it('respects the settings: no story, zero post', async () => {
    const { ig, results } = await run(users(3), {}, { likeStory: false, storyIfNoPosts: false, postsPerUser: 0 });
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

  it('list back at the top after each profile: goes back to its position, never "done" too early', async () => {
    const { outcome, results } = await run(users(40), { resetScrollOnReturn: true, initialLoaded: 14, loadStep: 14 }, { postsPerUser: 0, likeStory: false });
    expect(outcome).toEqual({ status: 'done', reason: 'Fin de la liste' });
    expect(Object.values(results).filter((r) => r.state === 'done')).toHaveLength(40);
  });

  it('ends after two scrolls without any new account', async () => {
    const { outcome, ig } = await run(users(7), {}, { postsPerUser: 0, likeStory: false });
    expect(outcome).toEqual({ status: 'done', reason: 'Fin de la liste' });
    expect(ig.scrolls).toBe(2);
  });

  it('pauses (never "done") when scrolling has no effect and accounts remain below', async () => {
    const { outcome } = await run(users(30), { brokenScroll: true }, { postsPerUser: 0, likeStory: false });
    expect(outcome.status).toBe('paused');
    expect(outcome.reason).toMatch(/aucun effet/);
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

  it('stops at the session target with exactly that many likes', async () => {
    const { outcome, ig } = await run(users(10), {}, { maxLikesPerSession: 4, postsPerUser: 2 });
    expect(outcome.status).toBe('paused');
    expect(outcome.reason).toBe('Objectif de la session atteint (4 likes).');
    expect(ig.likesSent).toBe(4);
  });

  it('target reached at the end of an account: stops without opening another profile', async () => {
    const { outcome, ig, progress } = await run(users(10), {}, { maxLikesPerSession: 4, postsPerUser: 2, likeStory: false });
    expect(outcome.reason).toBe('Objectif de la session atteint (4 likes).');
    expect(ig.likesSent).toBe(4);
    expect(opened(ig, 'user02')).toBe(0);
    expect(progress[progress.length - 1]!.sessionLikes).toBe(4);
  });

  it('counts the likes of earlier runs of the session against its target', async () => {
    const { outcome, ig, progress } = await run(users(10), {}, { maxLikesPerSession: 5, postsPerUser: 2, likeStory: false }, ({ store }) =>
      store.likes.set(SID, 3),
    );
    expect(outcome.reason).toBe('Objectif de la session atteint (5 likes).');
    expect(ig.likesSent).toBe(2);
    expect(progress[progress.length - 1]!.sessionLikes).toBe(5);
  });

  it('dry run: stops at the target with simulated likes, none sent', async () => {
    const { outcome, ig } = await run(users(10), {}, { dryRun: true, maxLikesPerSession: 3, postsPerUser: 1, likeStory: false });
    expect(outcome.reason).toBe('Objectif de la session atteint (3 likes simulés).');
    expect(ig.likesSent).toBe(0);
    expect(opened(ig, 'user03')).toBe(0);
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

  it('refuses real likes for 48 h after an Instagram warning, dry run still possible', async () => {
    const warned = ({ store, clock }: { store: MemoryStore; clock: FakeClock }) =>
      store.events.push({ type: 'instagram_warning', payload: {}, at: clock.t - 3 * 3600_000 });
    const real = await run(users(5), {}, { postsPerUser: 1 }, warned);
    expect(real.outcome.status).toBe('paused');
    expect(real.outcome.reason).toMatch(/^Instagram a limité le compte le .* aucun vrai like avant le /);
    expect(real.ig.taps).toEqual([]);
    const dry = await run(users(5), {}, { postsPerUser: 1, dryRun: true }, warned);
    expect(dry.outcome.status).toBe('done');
    const later = await run(users(5), {}, { postsPerUser: 1 }, ({ store, clock }) =>
      store.events.push({ type: 'instagram_warning', payload: {}, at: clock.t - 49 * 3600_000 }),
    );
    expect(later.outcome.status).toBe('done');
    expect(later.ig.likesSent).toBeGreaterThan(0);
  });

  it('a warning met during the run blocks the next real run', async () => {
    const { store } = await run(users(10), { warningAfterLikes: 1 }, { postsPerUser: 2 });
    expect(await store.lastWarningAt()).not.toBeNull();
  });

  it('explains a list whose accounts never load (Instagram limit) instead of a generic error', async () => {
    const { outcome } = await run([], {}, {});
    expect(outcome).toEqual({ status: 'paused', reason: LIST_EMPTY });
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

describe('Engine — pace', () => {
  it('pauses on the list between two accounts, for a duration drawn in the chosen range', async () => {
    const { progress } = await run(users(3), {}, { postsPerUser: 0, likeStory: false, storyIfNoPosts: false, pace: 'slow' });
    const pauses = progress.filter((p) => p.step === 'pause');
    expect(pauses).toHaveLength(2); // none before the first account
    expect(pauses[0]!.text).toBe('Pause de 33 s · suivant : @user01'); // 20 + 0.5 × 25 s
  });

  it('draws every pause inside its range, from the shortest to the longest', async () => {
    for (const r of [0, 0.999]) {
      const sleeps: number[] = [];
      await run(
        users(2),
        {},
        { postsPerUser: 1, likeStory: true, pace: 'normal' },
        ({ clock }) => {
          const sleep = clock.sleep.bind(clock);
          clock.sleep = async (ms: number) => {
            sleeps.push(ms);
            return sleep(ms);
          };
        },
        () => r,
      );
      expect(sleeps.filter((ms) => ms >= 8_000)).toEqual([r === 0 ? 8_000 : 19_988]); // between the 2 accounts
      expect(sleeps).toContain(r === 0 ? 1_500 : 3_498); // on each post
      expect(sleeps).toContain(r === 0 ? 800 : 1_999); // on each story
    }
  });

  it('a manual stop during a pause ends the run at once', async () => {
    let ctrlRef: AbortController | null = null;
    const { outcome, results } = await run(users(5), {}, { postsPerUser: 0, likeStory: false }, ({ ctrl, clock }) => {
      ctrlRef = ctrl;
      const sleep = clock.sleep.bind(clock);
      clock.sleep = async (ms: number) => {
        if (ms >= 20_000) ctrlRef!.abort('manual');
        return sleep(ms);
      };
    });
    expect(outcome).toEqual({ status: 'paused', reason: 'Arrêtée par vous' });
    expect(results.user00!.state).toBe('done');
    expect(results.user01!.state).toBe('todo');
  });
});

describe('Engine — overlay', () => {
  it('highlights the row and tags where the list is now, not where it was while sliding in', async () => {
    const { ig } = await run(users(4), { listSlidesIn: 1 }, { postsPerUser: 0, likeStory: false });
    expect(ig.highlights.find((h) => h?.label === '@user00')?.box.y).toBe(120);
    const shown = ig.rowTags.filter((t): t is NonNullable<typeof t> => !!t && t.length > 0);
    const beforeTap = shown.filter((t) => t[0]!.label === 'Suivant').pop()!;
    expect(beforeTap[0]!.row.y).toBe(120);
    expect(beforeTap[0]!.name).toEqual({ x: 70, y: 133, w: 48, h: 18 });
  });
});

describe('Engine — one engine, several runs (as in the app)', () => {
  it('starts every run from zero: target, counters and pauses of the previous run do not carry over', async () => {
    const ig = new FakeInstagram('atelier.lumen', users(10));
    const store = new MemoryStore();
    const clock = new FakeClock();
    const engine = new Engine({ page: ig, vision: ig, store, clock, random: () => 0.5 });
    const ctx = (sessionId: string, progress: Progress[]): RunContext => ({
      sessionId,
      targetAccount: 'atelier.lumen',
      settings: { ...DEFAULT_SETTINGS, dryRun: true, autoStopMin: 0, postsPerUser: 1, likeStory: false, maxLikesPerSession: 2 },
      previousElapsedMs: 0,
      signal: new AbortController().signal,
      onProgress: (p) => progress.push(p),
    });
    const first: Progress[] = [];
    expect((await engine.run(ctx('a', first))).reason).toBe('Objectif de la session atteint (2 likes simulés).');
    const second: Progress[] = [];
    expect((await engine.run(ctx('b', second))).reason).toBe('Objectif de la session atteint (2 likes simulés).');
    expect(second.filter((p) => p.step === 'pause')).toHaveLength(1); // none before its first account
    expect(second[second.length - 1]!.dryLikes).toBe(2);
  });
});

describe('Engine — overlay on the profile', () => {
  it('clears the tile highlight once the post is open (it would stay over the post during the pause)', async () => {
    const { ig } = await run(users(1), {}, { postsPerUser: 1, likeStory: false, dryRun: true });
    const i = ig.highlights.findIndex((h) => h?.label === 'Publication 1');
    expect(ig.highlights[i + 1]).toBeNull();
  });
});

describe('Engine — scan', () => {
  it('accepts a followers list with rows and a back button', async () => {
    const ig = new FakeInstagram('atelier.lumen', users(8));
    const r = await new Engine({ page: ig, vision: ig, store: new MemoryStore(), clock: new FakeClock() }).scan();
    expect(r).toMatchObject({ ok: true, targetAccount: 'atelier.lumen', visibleRows: 7 });
  });

  it('says so when the list is open but its accounts never show (grey placeholders)', async () => {
    const ig = new FakeInstagram('atelier.lumen', []);
    const r = await new Engine({ page: ig, vision: ig, store: new MemoryStore(), clock: new FakeClock() }).scan();
    expect(r).toMatchObject({ ok: false, message: expect.stringMatching(/aucun compte ne s’affiche.*24 à 48 h/) });
  });

  it('refuses any other screen with the expected message', async () => {
    const ig = new FakeInstagram('atelier.lumen', users(8));
    ig.stack.push({ kind: 'profile', u: 'user00' });
    const r = await new Engine({ page: ig, vision: ig, store: new MemoryStore(), clock: new FakeClock() }).scan();
    expect(r).toMatchObject({ ok: false, message: 'Ouvrez la liste des abonnés d’un compte dans la WebView.' });
  });
});
