import { canInject } from '@/recognition/url';

export class InjectionBlockedError extends Error {
  constructor(url: string) {
    super(`Injection refusée sur cette page (${url})`);
    this.name = 'InjectionBlockedError';
  }
}

export class RpcTimeoutError extends Error {
  constructor(ms: number) {
    super(`La page n'a pas répondu en ${ms} ms`);
    this.name = 'RpcTimeoutError';
  }
}

type Pending = { resolve: (v: unknown) => void; reject: (e: Error) => void; timer: ReturnType<typeof setTimeout> };

type Reply = { __ac: 1; id: string; ok: boolean; value?: unknown; error?: string };

function isReply(v: unknown): v is Reply {
  return !!v && typeof v === 'object' && (v as Reply).__ac === 1 && typeof (v as Reply).id === 'string';
}

/**
 * Request/response over the WebView message channel. Scripts are injected on demand
 * (never through a global `injectedJavaScript`) and only on pages allowed by `canInject`.
 */
export class WebViewRpc {
  private pending = new Map<string, Pending>();
  private seq = 0;

  constructor(
    private readonly inject: (js: string) => void,
    private readonly currentUrl: () => string,
  ) {}

  /** `body` is the body of a function run in the page; its return value (or promise) is sent back as JSON. */
  call<T>(body: string, timeoutMs = 4000): Promise<T> {
    const url = this.currentUrl();
    if (!canInject(url)) return Promise.reject(new InjectionBlockedError(url));
    const id = `r${++this.seq}`;
    return new Promise<T>((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(new RpcTimeoutError(timeoutMs));
      }, timeoutMs);
      this.pending.set(id, { resolve: resolve as (v: unknown) => void, reject, timer });
      this.inject(wrap(id, body));
    });
  }

  /** Returns true when the message belonged to the RPC channel. */
  handleMessage(data: string): boolean {
    let msg: unknown;
    try {
      msg = JSON.parse(data);
    } catch {
      return false;
    }
    if (!isReply(msg)) return false;
    const p = this.pending.get(msg.id);
    if (!p) return true;
    this.pending.delete(msg.id);
    clearTimeout(p.timer);
    if (msg.ok) p.resolve(msg.value);
    else p.reject(new Error(msg.error ?? 'Erreur dans la page'));
    return true;
  }

  /** Page changed or screen closed: fail every pending call. */
  cancelAll(reason = 'Page rechargée'): void {
    for (const [, p] of this.pending) {
      clearTimeout(p.timer);
      p.reject(new Error(reason));
    }
    this.pending.clear();
  }
}

export function wrap(id: string, body: string): string {
  const send = `function(m){window.ReactNativeWebView.postMessage(JSON.stringify(m))}`;
  return `(function(){var __send=${send};var __id=${JSON.stringify(id)};
try{Promise.resolve((function(){${body}\n})()).then(function(v){__send({__ac:1,id:__id,ok:true,value:v})},function(e){__send({__ac:1,id:__id,ok:false,error:String(e&&e.message||e)})});}
catch(e){__send({__ac:1,id:__id,ok:false,error:String(e&&e.message||e)})}})();true;`;
}
