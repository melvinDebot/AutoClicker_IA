// Fake Instagram for the engine tests: page (DOM), vision (snapshot), store and clock in memory.
import type { DomEl, ListRow, PageState, TapResult } from '@/recognition/page';
import type {
  Clock,
  ColorStats,
  Highlight,
  PagePort,
  SnapshotRef,
  StorePort,
  UserRecord,
  UserResult,
  VisionPort,
} from '../ports';
import type { Box, TextBlock } from '../types';

export type FakeUser = {
  username: string;
  private?: boolean;
  story?: boolean;
  storyLiked?: boolean;
  /** One entry per post: already liked or not. */
  posts?: boolean[];
};

export type FakeOptions = {
  pageSize?: number;
  initialLoaded?: number;
  loadStep?: number;
  /** The list order changes every time the engine comes back to it. */
  reorderOnReturn?: boolean;
  /** Loaded chunks repeat an already shown account. */
  duplicates?: boolean;
  /** From this scroll (1-based), the spinner never stops. */
  stuckLoadingAtScroll?: number;
  warningAfterLikes?: number;
  dismissDialogOnce?: boolean;
  disconnectAfterInspects?: number;
  /** Like taps have no effect (DOM events ignored by the page). */
  ignoreLikeTaps?: boolean;
  /** OCR reads another name on this account's row. */
  ocrLiesFor?: string;
  /** Opening this account's story shows another account's story. */
  storyAdvancesFor?: string;
  /** The profile is painted late: the first N snapshots of a profile show nothing. */
  lateProfileSnapshots?: number;
  /** Post tiles are below the fold until the profile is scrolled once. */
  tilesBelowFold?: boolean;
  /** The post heart is below the image until revealed. */
  heartBelowFold?: boolean;
};

type Frame =
  | { kind: 'followers' }
  | { kind: 'profile'; u: string }
  | { kind: 'story'; u: string }
  | { kind: 'post'; u: string; k: number };

const VW = 390;
const VH = 800;
const ROW_H = 64;
const LIST_TOP = 120;

const el = (id: string, target: DomEl['target'], box: Box, extra: Partial<DomEl> = {}): DomEl => ({
  id,
  target,
  label: '',
  text: '',
  box,
  visible: true,
  ...extra,
});

export class FakeInstagram implements PagePort, VisionPort {
  stack: Frame[] = [{ kind: 'followers' }];
  order: string[] = [];
  users = new Map<string, FakeUser>();
  scrollTop = 0;
  scrolls = 0;
  loadingTicks = 0;
  inspects = 0;
  likesSent = 0;
  dialog = false;
  taps: string[] = [];
  highlights: Highlight[] = [];
  private pending: string[] = [];
  private o: Required<Omit<FakeOptions, 'stuckLoadingAtScroll' | 'warningAfterLikes' | 'disconnectAfterInspects' | 'ocrLiesFor' | 'storyAdvancesFor' | 'lateProfileSnapshots' | 'tilesBelowFold' | 'heartBelowFold'>> &
    FakeOptions;

  constructor(
    readonly target: string,
    users: FakeUser[],
    options: FakeOptions = {},
  ) {
    this.o = { pageSize: 7, initialLoaded: 14, loadStep: 14, reorderOnReturn: false, duplicates: false, dismissDialogOnce: false, ignoreLikeTaps: false, ...options };
    users.forEach((u) => this.users.set(u.username, { posts: [], ...u }));
    this.pending = users.map((u) => u.username);
    this.load(this.o.initialLoaded);
    this.dialog = this.o.dismissDialogOnce;
  }

  private load(n: number) {
    const chunk = this.pending.splice(0, n);
    if (this.o.duplicates && this.order.length && chunk.length) chunk.splice(1, 0, this.order[0]!);
    this.order.push(...chunk);
  }

  private get frame(): Frame {
    return this.stack[this.stack.length - 1]!;
  }

  user(u: string): FakeUser {
    const x = this.users.get(u);
    if (!x) throw new Error(`unknown ${u}`);
    return x;
  }

  // ---------------- PagePort

  async inspect(): Promise<PageState> {
    this.inspects += 1;
    if (this.o.disconnectAfterInspects !== undefined && this.inspects > this.o.disconnectAfterInspects) {
      throw new Error('La page n’a pas répondu en 4000 ms');
    }
    const f = this.frame;
    const base: PageState = {
      url: '',
      kind: 'other',
      viewport: { w: VW, h: VH },
      loading: false,
      dialogs: [],
      warning:
        this.o.warningAfterLikes !== undefined && this.likesSent >= this.o.warningAfterLikes ? 'try again later' : null,
      back: el('back', 'back_button', { x: 8, y: 8, w: 40, h: 40 }),
      list: null,
      profile: null,
      story: null,
      post: null,
    };
    if (f.kind === 'followers') {
      if (this.loadingTicks > 0) {
        this.loadingTicks -= 1;
        if (this.loadingTicks === 0) this.load(this.o.loadStep);
      }
      const visible = this.order.slice(this.scrollTop, this.scrollTop + this.o.pageSize);
      const rows: ListRow[] = visible.map((u, i) => {
        const box = { x: 0, y: LIST_TOP + i * ROW_H, w: VW, h: ROW_H };
        return {
          username: u,
          link: el(`row:${u}`, 'user_row', { x: 70, y: box.y + 12, w: 200, h: 20 }, { href: `/${u}/`, text: u }),
          box,
          avatar: { x: 12, y: box.y + 8, w: 48, h: 48 },
          storyRing: !!this.user(u).story,
          fullyVisible: true,
        };
      });
      return {
        ...base,
        url: `https://www.instagram.com/${this.target}/followers/`,
        kind: 'followers',
        username: this.target,
        loading: this.loadingTicks > 0,
        list: {
          title: el('title', 'followers_list', { x: 140, y: 60, w: 110, h: 24 }, { text: 'followers' }),
          rows,
          suggestedVisible: false,
          scroll: { top: this.scrollTop * ROW_H, height: this.order.length * ROW_H, client: VH },
        },
      };
    }
    if (f.kind === 'profile') {
      const u = this.user(f.u);
      const dialogs = this.dialog
        ? [{ text: 'turn on notifications', box: { x: 40, y: 300, w: 300, h: 200 }, warning: false, dismiss: el('dismiss', 'dialog', { x: 60, y: 440, w: 260, h: 44 }) }]
        : [];
      return {
        ...base,
        url: `https://www.instagram.com/${f.u}/`,
        kind: 'profile',
        username: f.u,
        dialogs,
        profile: {
          username: f.u,
          privateNotice: u.private ? el('private', 'private_notice', { x: 60, y: 520, w: 270, h: 30 }) : null,
          emptyNotice: !u.private && !(u.posts ?? []).length,
          postsCount: (u.posts ?? []).length,
          avatar: el(`ring:${f.u}`, 'avatar_story', { x: 16, y: 80, w: 90, h: 90 }),
          storyRing: !!u.story && !u.private,
          tiles: u.private || (this.o.tilesBelowFold && this.pageScrolls === 0) ? [] : (u.posts ?? []).map((_, k) => el(`tile:${f.u}:${k}`, 'post_tile', { x: (k % 3) * 130, y: 420 + Math.floor(k / 3) * 130, w: 128, h: 128 }, { href: `/p/${f.u}-${k}/` })),
        },
      };
    }
    if (f.kind === 'story') {
      const u = this.user(f.u);
      return {
        ...base,
        url: `https://www.instagram.com/stories/${f.u}/1/`,
        kind: 'story',
        username: f.u,
        story: {
          username: f.u,
          like: el(`heart-s:${f.u}`, u.storyLiked ? 'like_filled' : 'like_empty', { x: 340, y: 740, w: 28, h: 28 }),
          liked: !!u.storyLiked,
          close: el(`close:${f.u}`, 'story_close', { x: 350, y: 60, w: 30, h: 30 }),
        },
      };
    }
    const liked = !!this.user(f.u).posts?.[f.k];
    return {
      ...base,
      url: `https://www.instagram.com/p/${f.u}-${f.k}/`,
      kind: 'post',
      post:
        this.o.heartBelowFold && !this.heartRevealed
          ? { like: null, liked: null }
          : { like: el(`heart-p:${f.u}:${f.k}`, liked ? 'like_filled' : 'like_empty', { x: 12, y: 560, w: 26, h: 26 }), liked },
    };
  }

  async tap(e: DomEl): Promise<TapResult> {
    this.taps.push(e.id);
    const [kind, a, b] = e.id.split(':');
    switch (kind) {
      case 'row':
        this.stack.push({ kind: 'profile', u: a! });
        break;
      case 'ring':
        this.stack.push({ kind: 'story', u: a === this.o.storyAdvancesFor ? this.otherThan(a!) : a! });
        break;
      case 'tile':
        this.heartRevealed = false;
        this.stack.push({ kind: 'post', u: a!, k: Number(b) });
        break;
      case 'heart-s':
        if (!this.o.ignoreLikeTaps) {
          this.user(a!).storyLiked = true;
          this.likesSent += 1;
        }
        break;
      case 'heart-p':
        if (!this.o.ignoreLikeTaps) {
          this.user(a!).posts![Number(b)] = true;
          this.likesSent += 1;
        }
        break;
      case 'close':
        await this.back();
        break;
      case 'dismiss':
        this.dialog = false;
        break;
      default:
        return { ok: false, reason: 'stale' };
    }
    return { ok: true };
  }

  private otherThan(u: string) {
    return [...this.users.keys()].find((x) => x !== u && this.user(x).story) ?? u;
  }

  async back(): Promise<void> {
    if (this.stack.length > 1) this.stack.pop();
    if (this.frame.kind === 'followers') this.pageScrolls = 0;
    if (this.frame.kind === 'followers' && this.o.reorderOnReturn) {
      // Instagram reorders the visible window when coming back.
      const start = this.scrollTop;
      const win = this.order.slice(start, start + this.o.pageSize).reverse();
      this.order.splice(start, win.length, ...win);
    }
  }

  async scrollList(): Promise<void> {
    this.scrolls += 1;
    if (this.o.stuckLoadingAtScroll !== undefined && this.scrolls >= this.o.stuckLoadingAtScroll) {
      this.loadingTicks = Number.POSITIVE_INFINITY;
      return;
    }
    const next = this.scrollTop + this.o.pageSize;
    if (next + this.o.pageSize > this.order.length && this.pending.length) this.loadingTicks = 2;
    this.scrollTop = Math.min(next, Math.max(0, this.order.length + (this.pending.length ? this.o.loadStep : 0) - this.o.pageSize));
  }

  pageScrolls = 0;
  heartRevealed = false;
  async scrollPage(): Promise<void> {
    this.pageScrolls += 1;
  }
  async revealHeart(): Promise<boolean> {
    if (this.frame.kind !== 'post' && this.frame.kind !== 'story') return false;
    this.heartRevealed = true;
    return true;
  }

  highlight(h: Highlight): void {
    this.highlights.push(h);
  }

  // ---------------- VisionPort (what the snapshot shows)

  available() {
    return true;
  }

  async snapshot(): Promise<SnapshotRef> {
    return { uri: 'mem://snap', width: VW, height: VH, scale: 3 };
  }

  async release(): Promise<void> {}

  async ocr(_s: SnapshotRef, region?: Box): Promise<TextBlock[]> {
    const st = await this.peek();
    const blocks: TextBlock[] = [];
    st.list?.rows.forEach((r) =>
      blocks.push({ text: r.username === this.o.ocrLiesFor ? 'someone.else' : r.username, confidence: 1, box: r.link.box }),
    );
    if (st.list?.title) blocks.push({ text: 'Followers', confidence: 1, box: st.list.title.box });
    if (st.profile && this.o.lateProfileSnapshots && this.lateLeft() > 0) return [];
    if (st.profile) {
      blocks.push({ text: st.profile.username, confidence: 1, box: { x: 120, y: 20, w: 150, h: 24 } });
      if (st.profile.privateNotice) blocks.push({ text: 'This account is private', confidence: 1, box: st.profile.privateNotice.box });
    }
    if (!region) return blocks;
    return blocks.filter(
      (b) => b.box.x < region.x + region.w && b.box.x + b.box.w > region.x && b.box.y < region.y + region.h && b.box.y + b.box.h > region.y,
    );
  }

  async colors(_s: SnapshotRef, _region: Box, annulus = false): Promise<ColorStats> {
    const st = await this.peek();
    const none = { red: 0, saturated: 0, grey: 0, dark: 0.2, light: 0.6, meanLuma: 0.6 };
    if (annulus) return st.profile?.storyRing ? { ...none, saturated: 0.6 } : none;
    const liked = st.story?.liked ?? st.post?.liked ?? false;
    return liked ? { ...none, red: 0.4 } : none;
  }

  private late = 0;
  private lateLeft() {
    this.late += 1;
    return (this.o.lateProfileSnapshots ?? 0) - this.late + 1;
  }

  /** Same view as inspect(), without side effects on counters or loading. */
  private async peek(): Promise<PageState> {
    const saved = { inspects: this.inspects, ticks: this.loadingTicks, order: [...this.order], pending: [...this.pending] };
    const disconnect = this.o.disconnectAfterInspects;
    this.o.disconnectAfterInspects = undefined;
    try {
      return await this.inspect();
    } finally {
      this.o.disconnectAfterInspects = disconnect;
      this.inspects = saved.inspects;
      this.loadingTicks = saved.ticks;
      this.order = saved.order;
      this.pending = saved.pending;
    }
  }
}

/** In-memory store with the same rules as the SQLite one (unique username per session). */
export class MemoryStore implements StorePort {
  users = new Map<string, Map<string, { state: UserRecord['state']; result?: UserResult; window: number }>>();
  sessions = new Map<string, Record<string, unknown>>();
  likes = new Map<string, number>();
  today = 0;
  events: { type: string; payload: unknown }[] = [];

  private of(sid: string) {
    let m = this.users.get(sid);
    if (!m) this.users.set(sid, (m = new Map()));
    return m;
  }

  seed(sid: string, usernames: string[], state: UserRecord['state'] = 'done') {
    usernames.forEach((u) => this.of(sid).set(u, { state, window: 0 }));
  }

  async loadUsers(sid: string) {
    return new Map([...this.of(sid)].map(([u, v]) => [u, v.state] as const));
  }
  async addUsers(sid: string, usernames: string[], windowIndex: number) {
    usernames.forEach((u) => {
      if (!this.of(sid).has(u)) this.of(sid).set(u, { state: 'todo', window: windowIndex });
    });
    return this.of(sid).size;
  }
  async markProcessing(sid: string, u: string) {
    this.of(sid).get(u)!.state = 'processing';
  }
  async resetUser(sid: string, u: string) {
    this.of(sid).set(u, { state: 'todo', window: this.of(sid).get(u)?.window ?? 0 });
  }
  async saveResult(sid: string, u: string, result: UserResult, likes: { story: number; post: number }) {
    this.of(sid).set(u, { state: result.state, result, window: this.of(sid).get(u)?.window ?? 0 });
    const n = likes.story + likes.post;
    this.likes.set(sid, (this.likes.get(sid) ?? 0) + n);
    this.today += n;
  }
  async updateSession(sid: string, patch: Record<string, unknown>) {
    this.sessions.set(sid, { ...this.sessions.get(sid), ...patch });
  }
  async likeCounts(sid: string) {
    return { session: this.likes.get(sid) ?? 0, today: this.today };
  }
  async event(_sid: string, type: string, payload: unknown) {
    this.events.push({ type, payload });
  }
  results(sid: string) {
    return Object.fromEntries([...this.of(sid)].map(([u, v]) => [u, v]));
  }
}

export class FakeClock implements Clock {
  t = 1_700_000_000_000;
  now() {
    return this.t;
  }
  async sleep(ms: number) {
    this.t += ms;
  }
}
