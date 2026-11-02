// Real PagePort: the inspection, tap and scroll scripts injected on demand through the RPC.
import type { Highlight, PagePort } from '@/engine/ports';
import { inspectScript, pageScrollScript, scrollScript, tapScript, type RawPage } from '@/recognition/domScript';
import type { PageState, TapResult } from '@/recognition/page';
import { canInject, parseInstagramUrl } from '@/recognition/url';
import type { WebViewRpc } from './rpc';

const INSPECT = inspectScript();

function emptyPage(url: string): PageState {
  const p = parseInstagramUrl(url);
  return {
    url,
    kind: p.kind,
    username: p.username,
    viewport: { w: 0, h: 0 },
    loading: false,
    dialogs: [],
    warning: null,
    back: null,
    list: null,
    profile: null,
    story: null,
    post: null,
  };
}

export function createPagePort(opts: {
  rpc: WebViewRpc;
  currentUrl: () => string;
  goBack: () => void;
  onHighlight: (h: Highlight) => void;
}): PagePort {
  return {
    async inspect() {
      const url = opts.currentUrl();
      // Sign-in and account pages: no injection at all, the engine only sees the URL.
      if (!canInject(url)) return emptyPage(url);
      const raw = await opts.rpc.call<RawPage>(INSPECT, 5000);
      const p = parseInstagramUrl(raw.url);
      return { ...raw, kind: p.kind, username: p.username };
    },
    tap: (el) => opts.rpc.call<TapResult>(tapScript(el.id), 4000),
    async back() {
      opts.goBack();
    },
    async scrollList(dy) {
      await opts.rpc.call<number>(scrollScript(dy), 4000);
    },
    async scrollPage(dy) {
      await opts.rpc.call<number>(pageScrollScript(dy), 4000);
    },
    highlight: (h) => opts.onHighlight(h),
  };
}
