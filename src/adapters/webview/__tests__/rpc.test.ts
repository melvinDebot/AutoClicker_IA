import { dumpScript, tapTestScript } from '@/recognition/debugScripts';
import { InjectionBlockedError, RpcTimeoutError, WebViewRpc } from '../rpc';

const FOLLOWERS = 'https://www.instagram.com/atelier.lumen/followers/';

/** Runs injected scripts in Node, with the message channel react-native-webview provides in the page. */
function setup(url = FOLLOWERS) {
  let current = url;
  const injected: string[] = [];
  const rpc: WebViewRpc = new WebViewRpc(
    (js) => {
      injected.push(js);
      new Function(js)();
    },
    () => current,
  );
  const page = globalThis as unknown as { window?: Record<string, unknown> } & Record<string, unknown>;
  const w = (page.window ?? page) as Record<string, unknown>;
  w.ReactNativeWebView = { postMessage: (s: string) => rpc.handleMessage(s) };
  return { rpc, injected, setUrl: (u: string) => (current = u) };
}

describe('WebViewRpc', () => {
  it('returns the value of the page function', async () => {
    const { rpc } = setup();
    await expect(rpc.call<number>('return 1 + 2;')).resolves.toBe(3);
  });

  it('waits for promises returned by the page', async () => {
    const { rpc } = setup();
    await expect(rpc.call<string>('return Promise.resolve("ok");')).resolves.toBe('ok');
  });

  it('rejects with the page error', async () => {
    const { rpc } = setup();
    await expect(rpc.call('throw new Error("boom");')).rejects.toThrow('boom');
  });

  it('never injects anything on the sign-in page', async () => {
    const { rpc, injected } = setup('https://www.instagram.com/accounts/login/');
    await expect(rpc.call('return 1;')).rejects.toBeInstanceOf(InjectionBlockedError);
    expect(injected).toHaveLength(0);
  });

  it('times out when the page does not answer', async () => {
    jest.useFakeTimers();
    const rpc = new WebViewRpc(
      () => {},
      () => FOLLOWERS,
    );
    const p = rpc.call('return 1;', 500);
    jest.advanceTimersByTime(501);
    await expect(p).rejects.toBeInstanceOf(RpcTimeoutError);
    jest.useRealTimers();
  });

  it('ignores messages that are not RPC replies', () => {
    const { rpc } = setup();
    expect(rpc.handleMessage('not json')).toBe(false);
    expect(rpc.handleMessage(JSON.stringify({ type: 'other' }))).toBe(false);
  });
});

describe('debug scripts', () => {
  it('compile', () => {
    expect(() => new Function(dumpScript(true))).not.toThrow();
    expect(() => new Function(dumpScript(false))).not.toThrow();
    expect(() => new Function(tapTestScript('e12'))).not.toThrow();
  });
});
