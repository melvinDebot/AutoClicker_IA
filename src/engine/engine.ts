// Automation engine: pure TypeScript, no React Native import. Every device access goes
// through the ports (page, vision, store, clock), so the whole flow is tested with a fake Instagram.
import type { DomEl, ListRow, PageState } from '@/recognition/page';
import { DOM, TEXT, TIMING, VISUAL } from '@/recognition/rules';
import { textMatches, usernameMatches } from '@/recognition/text';
import type { Highlight, Ports, Progress, RunContext, RunOutcome, ScanResult, Step, UserResult } from './ports';
import type { Box, PostResult, StoryResult } from './types';

/** Ends a run: `done` (end of the list) or `paused` (everything else, resumable). */
export class Stop extends Error {
  constructor(
    readonly status: 'done' | 'paused',
    readonly reason: string,
  ) {
    super(reason);
    this.name = 'Stop';
  }
}

export const ABORT_REASONS: Record<string, string> = {
  manual: 'Arrêtée par vous',
  background: 'Application passée en arrière-plan',
};

export const SCAN_FAIL = 'Ouvrez la liste des abonnés d’un compte dans la WebView.';

const AUTO_STOP_LABEL: Record<number, string> = { 15: '15 min', 30: '30 min', 60: '1 h' };

/** OCR lines plus their joins: a long name wrapped or truncated is read in several pieces. */
function withJoins(texts: string[]): string[] {
  const t = texts.map((x) => x.trim()).filter(Boolean);
  const pairs = t.slice(1).map((x, i) => `${t[i]}${x}`);
  return [...t, ...pairs, t.join('')];
}

function pathOf(url: string): string {
  try {
    return new URL(url).pathname;
  } catch {
    return url;
  }
}

/** « what OCR read » for stop messages (helps fixing rules). */
function readText(read: string[], sep = ' '): string {
  const t = read.filter(Boolean).slice(0, 3).join(' | ');
  return t ? `${sep}« ${t.length > 60 ? `${t.slice(0, 60)}…` : t} »` : `${sep}rien de lisible`;
}

function grow(b: Box, by: number): Box {
  return { x: b.x - by, y: b.y - by, w: b.w + by * 2, h: b.h + by * 2 };
}

export class Engine {
  private ctx!: RunContext;
  private known = new Map<string, 'todo' | 'processing' | 'done' | 'error'>();
  private processed = 0;
  private discovered = 0;
  private windowIndex = 0;
  private startedAt = 0;
  private likes = { story: 0, post: 0 };
  private pending = { story: 0, post: 0 };
  private dryLikes = 0;
  private catchUp = new Set<string>();
  private current: string | null = null;
  private processedThisRun = 0;

  constructor(private readonly p: Ports) {}

  // ---------------------------------------------------------------- scan

  /** Launch conditions: only what the WebView shows (no separate login check). */
  async scan(): Promise<ScanResult> {
    let s: PageState | null = null;
    try {
      s = await this.p.page.inspect();
    } catch {
      s = null;
    }
    const rows = s?.list?.rows.length ?? 0;
    const checks = [
      { label: s?.list ? `Liste d’abonnés${s.username ? ` de @${s.username}` : ''} reconnue` : 'Aucune liste d’abonnés à l’écran', ok: !!s?.list },
      { label: rows ? `${rows} compte${rows > 1 ? 's' : ''} visible${rows > 1 ? 's' : ''} repéré${rows > 1 ? 's' : ''}` : 'Aucun compte visible', ok: rows > 0 },
      { label: s?.back ? 'Bouton retour repéré' : 'Bouton retour introuvable', ok: !!s?.back },
    ];
    if (!s) return { ok: false, message: 'La page ne répond pas. Rechargez-la puis réessayez.', checks };
    if (s.warning) return { ok: false, message: `Avertissement d’Instagram à l’écran : « ${s.warning} ».`, checks };
    if (!s.list || rows === 0 || !s.back || !s.username) return { ok: false, message: SCAN_FAIL, checks };

    // Visual confirmation: the title (or a row) must be readable on the snapshot.
    if (this.p.vision.available() && s.list.title) {
      let ok: boolean;
      try {
        ok = await this.confirmText(s.list.title.box, (t) => textMatches(t, DOM.followersTitle) || textMatches(t, TEXT.followersWord));
      } catch (e) {
        return { ok: false, message: `Capture de l’écran impossible : ${e instanceof Error ? e.message : String(e)}`, checks };
      }
      if (!ok) {
        checks[0] = { label: 'Titre de la liste illisible sur la capture', ok: false };
        return { ok: false, message: 'Le DOM et la capture ne concordent pas sur la liste. Rechargez la page.', checks };
      }
    }
    return { ok: true, targetAccount: s.username, visibleRows: rows, checks };
  }

  // ---------------------------------------------------------------- run

  async run(ctx: RunContext): Promise<RunOutcome> {
    this.ctx = ctx;
    const { store, clock } = this.p;
    const sid = ctx.sessionId;
    this.startedAt = clock.now();
    let outcome: RunOutcome = { status: 'paused', reason: 'Arrêt' };
    try {
      if (!ctx.settings.dryRun && !this.p.vision.available()) {
        throw new Stop('paused', 'Module de vision absent : reconstruire le dev build avant une exécution réelle.');
      }
      this.known = await store.loadUsers(sid);
      for (const [u, st] of this.known) if (st === 'processing') this.known.set(u, 'todo');
      this.processed = [...this.known.values()].filter((v) => v === 'done' || v === 'error').length;
      this.discovered = this.known.size;
      await store.updateSession(sid, { status: 'running', endReason: null }, clock.now());
      await store.event(sid, 'run_start', { dryRun: ctx.settings.dryRun, resumeFrom: this.processed }, clock.now());
      await this.checkCaps();
      await this.loop();
    } catch (e) {
      outcome =
        e instanceof Stop
          ? { status: e.status, reason: e.reason }
          : { status: 'paused', reason: `Erreur inattendue : ${e instanceof Error ? e.message : String(e)}` };
    } finally {
      this.p.page.highlight(null);
      await this.returnToList(outcome);
      const now = clock.now();
      await store.updateSession(
        sid,
        {
          status: outcome.status,
          endReason: outcome.reason,
          elapsedMs: this.elapsed(),
          ...(outcome.status === 'done' ? { listEndReached: true } : {}),
        },
        now,
      );
      await store.event(sid, 'run_end', outcome, now);
    }
    return outcome;
  }

  private async loop(): Promise<void> {
    let emptyScrolls = 0;
    for (;;) {
      this.checkpoint();
      const s = await this.waitFor((st) => !!st.list && st.list.rows.length > 0, 'liste d’abonnés');
      if (s.username && s.username.toLowerCase() !== this.ctx.targetAccount.toLowerCase()) {
        throw new Stop('paused', `La liste affichée n’est pas celle de @${this.ctx.targetAccount}.`);
      }
      const rows = this.visibleRows(s);
      await this.register(rows);

      const next = rows.find((r) => this.known.get(r.username) === 'todo');
      for (const r of rows) {
        if (r === next) break;
        if (this.known.get(r.username) !== 'todo') this.catchUp.add(r.username);
      }
      if (next) {
        emptyScrolls = 0;
        await this.processUser(next);
        continue;
      }

      // Every visible account is handled: load the next ones.
      rows.forEach((r) => this.catchUp.add(r.username));
      this.emit('scroll', 'Défilement vers la suite de la liste');
      const after = await this.scrollAndWait(s);
      this.windowIndex += 1;
      await this.p.store.updateSession(this.ctx.sessionId, { windowIndex: this.windowIndex }, this.p.clock.now());
      const fresh = this.visibleRows(after).filter((r) => !this.known.has(r.username));
      if (fresh.length === 0 && !after.loading) {
        emptyScrolls += 1;
        await this.p.store.event(this.ctx.sessionId, 'scroll_empty', { emptyScrolls }, this.p.clock.now());
        if (emptyScrolls >= 2) throw new Stop('done', 'Fin de la liste');
      } else {
        emptyScrolls = 0;
      }
    }
  }

  private visibleRows(s: PageState): ListRow[] {
    const rows = s.list?.rows ?? [];
    const full = rows.filter((r) => r.fullyVisible);
    return full.length ? full : rows;
  }

  /** New usernames go to the session (state todo); already known ones are ignored. */
  private async register(rows: ListRow[]): Promise<void> {
    const fresh = [...new Set(rows.map((r) => r.username).filter((u) => !this.known.has(u)))];
    if (!fresh.length) return;
    this.discovered = await this.p.store.addUsers(this.ctx.sessionId, fresh, this.windowIndex, this.p.clock.now());
    fresh.forEach((u) => this.known.set(u, 'todo'));
  }

  private async scrollAndWait(s: PageState): Promise<PageState> {
    await this.p.page.scrollList(Math.round(s.viewport.h * 0.8));
    await this.sleep(TIMING.afterScroll);
    const deadline = this.p.clock.now() + TIMING.loadingTimeout;
    let last = await this.inspectGuarded();
    while (last.loading && this.p.clock.now() < deadline) {
      await this.sleep(TIMING.poll);
      last = await this.inspectGuarded();
    }
    if (last.loading) throw new Stop('paused', 'Instagram ne charge plus la suite de la liste (chargement bloqué).');
    if (!last.list) throw new Stop('paused', 'La liste a disparu après le défilement.');
    return last;
  }

  // ---------------------------------------------------------------- one account

  private async processUser(firstRow: ListRow): Promise<void> {
    let row = firstRow;
    const u = row.username;
    const { store, clock, page } = this.p;
    const sid = this.ctx.sessionId;
    this.current = u;
    this.pending = { story: 0, post: 0 };
    const result: UserResult = { state: 'done', privacy: 'unknown', story: null, posts: [] };
    // Instagram sometimes replaces a history entry: "back" from a post can land on the list directly.
    let onList = false;

    this.emit('pick_next_user', `${this.catchUpText()}suivant : @${u}`);
    // Visual confirmation of the row before opening it.
    let rowCheck = await this.confirmRow(row);
    if (!rowCheck.ok) {
      // Second chance: bring the row to the upper third of the list (away from banners and
      // freshly loaded rows), find it again by name and read it again. Still no match → pause.
      const s = await this.inspectGuarded();
      await this.p.page.scrollList(Math.round(row.box.y - s.viewport.h * 0.3));
      await this.sleep(TIMING.afterScroll);
      const again = this.visibleRows(await this.inspectGuarded()).find((r) => r.username === u);
      if (again) {
        row = again;
        rowCheck = await this.confirmRow(row);
      }
    }
    if (!rowCheck.ok) {
      throw new Stop('paused', `Le nom lu sur la capture${readText(rowCheck.read)} ne correspond pas au DOM (@${u}).`);
    }
    await store.markProcessing(sid, u);
    this.known.set(u, 'processing');

    try {
      this.mark(row.box, `@${u}`, 'target');
      this.emit('open_profile', `Ouverture de @${u}`);
      await this.tapOrStop(row.link, `ligne de @${u}`);
      const prof = await this.waitProfile(u);

      this.emit('classify_profile', 'Analyse du profil');
      const profCheck = await this.confirmSettled({ x: 0, y: 0, w: prof.viewport.w, h: prof.viewport.h * 0.25 }, (t) => usernameMatches(t, u));
      if (!profCheck.ok) {
        throw new Stop('paused', `Le profil affiché ne semble pas être @${u} (capture${readText(profCheck.read, ' : ')}).`);
      }
      // Read the profile again now that it is painted (counters, private notice, story ring).
      const pr = (await this.waitProfile(u)).profile;
      if (!pr) throw new Stop('paused', 'Profil illisible.');

      if (pr.privateNotice) {
        if (!(await this.confirmSettled(pr.privateNotice.box, (t) => textMatches(t, TEXT.privateNotice))).ok) {
          throw new Stop('paused', 'Compte privé selon le DOM mais pas selon la capture.');
        }
        result.privacy = 'private';
        this.emit('classify_profile', 'Compte privé · rien à toucher');
      } else {
        result.privacy = 'public';
        result.story = await this.handleStory(u, prof);
        const wanted =
          this.ctx.settings.postsPerUser > 0 && !pr.emptyNotice && pr.postsCount !== 0
            ? await this.revealTiles(u, Math.min(this.ctx.settings.postsPerUser, pr.postsCount ?? Number.POSITIVE_INFINITY))
            : [];
        for (let k = 0; k < wanted.length && !onList; k++) {
          const r = await this.handlePost(u, wanted[k]!, k);
          result.posts.push(r.result);
          onList = r.onList;
        }
        if (wanted.length === 0) this.emit('classify_profile', pr.emptyNotice ? 'Aucune publication' : 'Profil public');
      }

      if (!onList) {
        this.emit('back_to_list', 'Retour à la liste d’abonnés');
        this.mark(null);
        await page.back();
        await this.sleep(TIMING.afterTap);
      }

      await store.saveResult(sid, u, result, this.pending, clock.now());
      this.commitPending();
      this.known.set(u, 'done');
      this.processed += 1;
      this.processedThisRun += 1;
      this.emit('save', `Résultat enregistré pour @${u}`);
    } catch (e) {
      const reason = e instanceof Error ? e.message : String(e);
      if (this.pending.story + this.pending.post > 0) {
        // Likes really sent are always recorded, even when the run stops in the middle of an account.
        await store.saveResult(sid, u, result, this.pending, clock.now());
        this.commitPending();
        this.known.set(u, 'done');
        this.processed += 1;
      } else {
        // Nothing sent: back to todo, a resume will handle this account again.
        await store.resetUser(sid, u);
        this.known.set(u, 'todo');
      }
      await store.event(sid, 'user_interrupted', { username: u, reason }, clock.now());
      throw e;
    } finally {
      this.current = null;
    }
  }

  private async handleStory(u: string, prof: PageState): Promise<StoryResult> {
    const pr = prof.profile!;
    if (!this.ctx.settings.likeStory) return 'skipped';
    if (!pr.storyRing || !pr.avatar) return 'none';
    if (this.p.vision.available()) {
      const ring = await this.colors(pr.avatar.box, true);
      if (ring && ring.saturated < VISUAL.ringSaturated && ring.grey < VISUAL.ringGrey) {
        await this.p.store.event(this.ctx.sessionId, 'ring_mismatch', { username: u, ring }, this.p.clock.now());
        return 'none'; // DOM says story, the capture shows no ring: do not touch
      }
    }
    this.mark(pr.avatar.box, 'Story', 'target');
    this.emit('open_story', 'Ouverture de la story');
    await this.tapOrStop(pr.avatar, 'anneau de story');
    let st = await this.waitHeart('story', (s) => (s.kind === 'story' ? s.story : null));
    if (st.story!.username && st.story!.username.toLowerCase() !== u.toLowerCase()) {
      await this.closeStory(st, u);
      return 'error'; // the viewer moved to another account: never like it
    }
    let res: StoryResult;
    const heart = st.story!.like;
    if (!heart) throw new Stop('paused', `Cœur de la story introuvable (${pathOf(st.url)}).`);
    if (st.story!.liked) {
      res = 'already';
      this.emit('like_story', 'Story déjà likée · rien à toucher');
    } else {
      res = await this.like(heart, 'story', (s) => (s.kind === 'story' ? s.story?.liked ?? null : null));
    }
    await this.closeStory(st, u);
    return res;
  }

  private async closeStory(st: PageState, u: string) {
    this.emit('close_story', 'Fermeture de la story');
    if (st.story?.close) await this.tapOrStop(st.story.close, 'croix de la story');
    else await this.p.page.back();
    await this.waitProfile(u);
  }

  /**
   * The profile header often fills the screen: scrolls the profile until the first posts are
   * visible. Posts are then identified by their link (the grid moves when scrolling).
   */
  private async revealTiles(u: string, n: number): Promise<string[]> {
    let s = await this.waitProfile(u);
    for (let i = 0; i < 3 && (s.profile?.tiles.length ?? 0) < n; i++) {
      this.emit('classify_profile', 'Défilement vers les publications');
      await this.p.page.scrollPage(Math.round(s.viewport.h * 0.6));
      await this.sleep(TIMING.afterScroll);
      s = await this.waitProfile(u);
    }
    return (s.profile?.tiles ?? []).slice(0, n).map((t) => t.href ?? t.id);
  }

  /** Waits until the post with this link is visible on the profile, scrolling if needed. */
  private async tileOnScreen(u: string, href: string) {
    let s = await this.waitProfile(u);
    for (let i = 0; i < 4; i++) {
      const tile = s.profile?.tiles.find((t) => (t.href ?? t.id) === href);
      if (tile) return tile;
      await this.p.page.scrollPage(Math.round(s.viewport.h * 0.5));
      await this.sleep(TIMING.afterScroll);
      s = await this.waitProfile(u);
    }
    return null;
  }

  private async handlePost(u: string, href: string, k: number): Promise<{ result: PostResult; onList: boolean }> {
    const tile = await this.tileOnScreen(u, href);
    if (!tile) throw new Stop('paused', `Publication ${k + 1} introuvable.`);
    this.mark(tile.box, `Publication ${k + 1}`, 'target');
    this.emit('open_post', `Ouverture de la publication ${k + 1}`);
    await this.tapOrStop(tile, `publication ${k + 1}`);
    const ps = await this.waitHeart(`publication ${k + 1}`, (s) => s.post);
    const heart = ps.post!.like;
    if (!heart) throw new Stop('paused', `Cœur de la publication ${k + 1} introuvable (${pathOf(ps.url)}).`);
    let res: PostResult;
    if (ps.post!.liked) {
      res = 'already';
      this.emit('like_post', `Publication ${k + 1} déjà likée · rien à toucher`);
    } else {
      res = await this.like(heart, 'post', (s) => s.post?.liked ?? null);
    }
    this.emit('back', 'Retour au profil');
    this.mark(null);
    await this.p.page.back();
    const after = await this.waitFor(
      (s) => (s.kind === 'profile' && s.username?.toLowerCase() === u.toLowerCase()) || (!!s.list && s.list.rows.length > 0),
      `profil de @${u}`,
    );
    if (after.list) {
      await this.p.store.event(this.ctx.sessionId, 'back_landed_on_list', { username: u, post: k + 1 }, this.p.clock.now());
      return { result: res, onList: true };
    }
    return { result: res, onList: false };
  }

  /** Likes an empty heart (never a filled one), or only highlights it in dry run. */
  private async like(heart: DomEl, kind: 'story' | 'post', likedNow: (s: PageState) => boolean | null): Promise<'liked' | 'skipped'> {
    const step: Step = kind === 'story' ? 'like_story' : 'like_post';
    const label = kind === 'story' ? 'la story' : 'la publication';
    if (heart.target !== 'like_empty') throw new Stop('paused', 'Cœur dans un état inattendu.');
    // DOM says "empty": the capture must agree (a red heart means already liked).
    const c = await this.colors(heart.box);
    if (c && c.red >= VISUAL.heartRedFilled) {
      throw new Stop('paused', `Le cœur de ${label} paraît déjà rempli sur la capture : rien touché.`);
    }
    if (this.ctx.settings.dryRun) {
      this.dryLikes += 1;
      this.mark(heart.box, 'J’aime (essai à blanc)', 'dry');
      this.emit(step, `Essai à blanc : j’aime sur ${label} non envoyé`, `${kind === 'story' ? 'Story' : 'Post'} : like simulé`);
      await this.sleep(TIMING.afterTap);
      return 'skipped';
    }
    await this.checkCaps();
    this.mark(heart.box, 'J’aime', 'target');
    this.emit(step, `J’aime sur ${label}`);
    await this.tapOrStop(heart, `cœur de ${label}`);
    let domLiked: boolean | null = null;
    for (let i = 0; i < 4 && domLiked !== true; i++) {
      await this.sleep(TIMING.afterTap);
      domLiked = likedNow(await this.inspectGuarded());
    }
    const c2 = await this.colors(heart.box);
    if (domLiked !== true || (c2 && c2.red < VISUAL.heartRedFilled)) {
      throw new Stop('paused', `Le j’aime sur ${label} n’a pas été pris en compte (DOM ou capture). Rien d’autre n’a été touché.`);
    }
    this.pending[kind] += 1;
    this.mark(heart.box, 'Liké', 'done');
    this.emit(step, `${kind === 'story' ? 'Story likée' : 'Publication likée'}`, kind === 'story' ? 'Story likée' : 'Post liké');
    return 'liked';
  }

  // ---------------------------------------------------------------- helpers

  /**
   * After a pause in the middle of an account, goes back to the followers list (at most 3 history
   * steps) so that "Reprendre" works at once. Never after an Instagram warning, a sign-in request
   * or a move to the background (JavaScript is suspended there).
   */
  private async returnToList(outcome: RunOutcome): Promise<void> {
    if (outcome.status !== 'paused') return;
    if (/Avertissement|connexion ou une vérification|arrière-plan/.test(outcome.reason)) return;
    try {
      for (let i = 0; i < 3; i++) {
        const s = await this.p.page.inspect();
        if (s.kind === 'followers' || s.warning || s.kind === 'login' || s.kind === 'account_check') return;
        await this.p.page.back();
        await this.p.clock.sleep(TIMING.afterScroll);
      }
    } catch {
      // best effort only
    }
  }

  /**
   * Post or story page: its URL is there before its content. Waits for the heart, bringing it
   * into view (it is often below the image), a few times before giving up.
   */
  private async waitHeart(what: string, part: (s: PageState) => { like: DomEl | null } | null): Promise<PageState> {
    let s = await this.waitFor((x) => !!part(x), what);
    for (let i = 0; i < 6 && !part(s)?.like; i++) {
      await this.p.page.revealHeart().catch(() => false);
      await this.sleep(TIMING.settle);
      s = await this.waitFor((x) => !!part(x), what);
    }
    return s;
  }

  /** Profile of this account, with its header painted (the URL changes before the content). */
  private async waitProfile(u: string): Promise<PageState> {
    return this.waitFor(
      (s) =>
        s.kind === 'profile' &&
        s.username?.toLowerCase() === u.toLowerCase() &&
        !!s.profile &&
        (!!s.profile.avatar || !!s.profile.privateNotice || s.profile.postsCount !== null),
      `profil de @${u}`,
    );
  }

  /**
   * Row confirmation: re-reads the page before each OCR attempt, so that a list that moved
   * (scroll restored when coming back) is followed by username, never by a stale position.
   */
  private async confirmRow(row: ListRow): Promise<{ ok: boolean; read: string[] }> {
    let read: string[] = [];
    let box = row.link.box;
    for (let i = 0; i < 3; i++) {
      if (i > 0) {
        await this.sleep(TIMING.settle);
        const s = await this.inspectGuarded();
        const again = this.visibleRows(s).find((r) => r.username === row.username);
        if (!again) return { ok: false, read: [`@${row.username} n’est plus visible`] };
        box = again.link.box;
      }
      const r = await this.ocrTexts(box);
      if (r === null || withJoins(r).some((t) => usernameMatches(t, row.username))) return { ok: true, read: r ?? [] };
      read = r;
    }
    return { ok: false, read };
  }

  /** Waits for a precise screen. Not there twice in a row → pause. */
  private async waitFor(pred: (s: PageState) => boolean, what: string): Promise<PageState> {
    let last: PageState | null = null;
    for (let attempt = 0; attempt < 2; attempt++) {
      const deadline = this.p.clock.now() + TIMING.screenTimeout;
      while (this.p.clock.now() < deadline) {
        last = await this.inspectGuarded().catch((e: unknown) => {
          if (e instanceof Stop) throw e;
          return null;
        });
        if (last && pred(last)) return last;
        await this.sleep(TIMING.poll);
      }
    }
    throw new Stop(
      'paused',
      last ? `Écran attendu introuvable : ${what} (page : ${last.kind}).` : `Écran attendu introuvable : ${what} (la page ne répond pas, connexion ?).`,
    );
  }

  /** Inspection with the safety checks shared by every step. */
  private async inspectGuarded(): Promise<PageState> {
    this.checkpoint();
    const s = await this.p.page.inspect();
    if (s.warning) {
      await this.p.store.event(this.ctx.sessionId, 'instagram_warning', { text: s.warning }, this.p.clock.now());
      throw new Stop('paused', `Avertissement d’Instagram : « ${s.warning} ». Session arrêtée, rien n’a été contourné.`);
    }
    if (s.kind === 'login' || s.kind === 'account_check') {
      throw new Stop('paused', 'Instagram demande une connexion ou une vérification du compte.');
    }
    const blocking = s.dialogs.filter((d) => !d.warning);
    for (const d of blocking) {
      if (d.dismiss) {
        await this.p.store.event(this.ctx.sessionId, 'dialog_dismissed', { text: d.text.slice(0, 80) }, this.p.clock.now());
        await this.tapOrStop(d.dismiss, 'bouton « Pas maintenant »');
        await this.sleep(TIMING.afterTap);
        return this.p.page.inspect();
      }
      throw new Stop('paused', `Fenêtre inattendue : « ${d.text.slice(0, 80)} ».`);
    }
    return s;
  }

  private async tapOrStop(el: DomEl, what: string): Promise<void> {
    this.checkpoint();
    const r = await this.p.page.tap(el);
    if (!r.ok) {
      const why = r.reason === 'covered' ? `masqué par ${r.hit ?? 'un autre élément'}` : r.reason === 'stale' ? 'plus dans la page' : 'hors de l’écran';
      throw new Stop('paused', `Impossible de toucher ${what} : ${why}.`);
    }
  }

  /**
   * Same as confirmText, read again a few times: Instagram slides new pages in, so the first
   * snapshot can be taken before the page is painted. Still a disagreement after that → false.
   */
  private async confirmSettled(box: Box, ok: (text: string) => boolean): Promise<{ ok: boolean; read: string[] }> {
    let read: string[] = [];
    for (let i = 0; i < 3; i++) {
      if (i > 0) await this.sleep(TIMING.settle);
      const r = await this.ocrTexts(box);
      read = r ?? [];
      if (r === null || withJoins(r).some(ok)) return { ok: true, read: r ?? [] };
    }
    return { ok: false, read };
  }

  /** Texts read by OCR in a region; null without the vision module (dry run only). */
  private async ocrTexts(box: Box): Promise<string[] | null> {
    if (!this.p.vision.available()) return null;
    const snap = await this.p.vision.snapshot();
    try {
      return (await this.p.vision.ocr(snap, grow(box, 4))).map((b) => b.text);
    } finally {
      await this.p.vision.release(snap);
    }
  }

  /** OCR of a region on a fresh snapshot. Without the vision module (dry run only): accepted. */
  private async confirmText(box: Box, ok: (text: string) => boolean): Promise<boolean> {
    if (!this.p.vision.available()) return true;
    const snap = await this.p.vision.snapshot();
    try {
      const blocks = await this.p.vision.ocr(snap, grow(box, 4));
      return blocks.some((b) => ok(b.text));
    } finally {
      await this.p.vision.release(snap);
    }
  }

  private async colors(box: Box, annulus = false) {
    if (!this.p.vision.available()) return null;
    const snap = await this.p.vision.snapshot();
    try {
      return await this.p.vision.colors(snap, box, annulus);
    } finally {
      await this.p.vision.release(snap);
    }
  }

  private async checkCaps(): Promise<void> {
    if (this.ctx.settings.dryRun) return;
    const c = await this.p.store.likeCounts(this.ctx.sessionId, this.p.clock.now());
    const pending = this.pending.story + this.pending.post;
    if (c.session + pending >= this.ctx.settings.maxLikesPerSession) {
      throw new Stop('paused', `Plafond de la session atteint (${this.ctx.settings.maxLikesPerSession} likes).`);
    }
    if (c.today + pending >= this.ctx.settings.maxLikesPerDay) {
      throw new Stop('paused', `Plafond du jour atteint (${this.ctx.settings.maxLikesPerDay} likes).`);
    }
  }

  private checkpoint(): void {
    const { signal, settings } = this.ctx;
    if (signal.aborted) {
      const key = typeof signal.reason === 'string' ? signal.reason : 'manual';
      throw new Stop('paused', ABORT_REASONS[key] ?? 'Arrêtée');
    }
    const max = settings.autoStopMin;
    if (max > 0 && this.p.clock.now() - this.startedAt >= max * 60_000) {
      throw new Stop('paused', `Arrêt automatique (${AUTO_STOP_LABEL[max] ?? `${max} min`})`);
    }
  }

  private async sleep(ms: number) {
    this.checkpoint();
    await this.p.clock.sleep(ms, this.ctx.signal);
    this.checkpoint();
  }

  private commitPending() {
    this.likes.story += this.pending.story;
    this.likes.post += this.pending.post;
    this.pending = { story: 0, post: 0 };
  }

  private elapsed() {
    return this.ctx.previousElapsedMs + (this.p.clock.now() - this.startedAt);
  }

  /** Shown while a resumed session skips the accounts already handled. */
  private catchUpText() {
    const n = this.catchUp.size;
    if (!n || this.processedThisRun > 0) return '';
    return `Rattrapage : ${n} compte${n > 1 ? 's' : ''} déjà traité${n > 1 ? 's' : ''} ignoré${n > 1 ? 's' : ''} · `;
  }

  private mark(box: Box | null, label = '', tone: NonNullable<Highlight>['tone'] = 'target') {
    this.p.page.highlight(box ? { box, label, tone } : null);
  }

  private emit(step: Step, text: string, flash?: string) {
    const p: Progress = {
      step,
      text,
      username: this.current,
      index: Math.min(this.processed + (this.current ? 1 : 0), Math.max(this.discovered, 1)),
      processed: this.processed,
      discovered: this.discovered,
      likes: { story: this.likes.story + this.pending.story, post: this.likes.post + this.pending.post },
      dryLikes: this.dryLikes,
      skippedCatchUp: this.catchUp.size,
      elapsedMs: this.elapsed(),
      flash,
    };
    this.ctx.onProgress(p);
  }
}
