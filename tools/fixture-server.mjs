// DEVELOPMENT ONLY: serves the local fake Instagram (src/ui/debug/fixturePage.ts) to the simulator.
// Run on the Mac: `node tools/fixture-server.mjs` (Node 24 loads the .ts page as is), then in the app:
// debug › « Liste factice », or open autoclicker://?fixture=1. Nothing is ever sent to Instagram.
import { createServer } from 'node:http';

import { FIXTURE_PORT, FIXTURE_URL, fixtureHtml } from '../src/ui/debug/fixturePage.ts';

const html = fixtureHtml();
const handler = (req, res) => {
  if (req.method !== 'GET' || req.url === '/favicon.ico') {
    res.writeHead(404).end();
    return;
  }
  res.writeHead(200, { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' }).end(html);
};
// "localhost" can be IPv4 or IPv6 depending on the client: listen on both, this Mac only.
for (const host of ['127.0.0.1', '::1']) createServer(handler).listen(FIXTURE_PORT, host);
console.log(`Fake Instagram on ${FIXTURE_URL}`);
