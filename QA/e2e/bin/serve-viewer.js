#!/usr/bin/env node
/**
 * Copyright (c) Hathor Labs and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

// Serves the runs' viewers (QA/e2e/evidence) on localhost, to watch them from another machine
// through `tailscale serve`:
//
//   node QA/e2e/bin/serve-viewer.js [port]          (default 18090)
//   tailscale serve --bg <port>                       https://<this machine>.<tailnet>.ts.net/
//
// Only the viewers, the runs' index and the recordings are served: an evidence dir also holds
// the run's seeds and Maestro's logs. Recordings are served in byte ranges, which Safari needs to
// play a video at all and every browser needs to seek one.

const fs = require('fs');
const http = require('http');
const path = require('path');

const EVIDENCE = path.resolve(__dirname, '..', 'evidence');
const PORT = Number(process.argv[2] || 18090);
const ALLOWED = /^\/(index\.html|[\w-]+\/viewer\.html|[\w-]+\/([\w-]+\/)*screen\.mp4)$/;
const TYPES = { '.html': 'text/html; charset=utf-8', '.mp4': 'video/mp4' };

http.createServer((req, res) => {
  const url = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
  const name = url === '/' ? '/index.html' : url;
  const file = path.join(EVIDENCE, name);
  if (!ALLOWED.test(name) || !file.startsWith(`${EVIDENCE}${path.sep}`) || !fs.existsSync(file)) {
    res.writeHead(404).end('not found');
    return;
  }
  const { size } = fs.statSync(file);
  const headers = { 'Content-Type': TYPES[path.extname(file)], 'Accept-Ranges': 'bytes', 'Cache-Control': 'no-cache' };
  const range = /^bytes=(\d*)-(\d*)$/.exec(req.headers.range || '');
  if (range && (range[1] || range[2])) {
    // "bytes=-N" is the last N bytes.
    const start = range[1] ? Number(range[1]) : Math.max(0, size - Number(range[2]));
    const end = range[1] && range[2] ? Math.min(Number(range[2]), size - 1) : size - 1;
    if (start > end || start >= size) {
      res.writeHead(416, { 'Content-Range': `bytes */${size}` }).end();
      return;
    }
    res.writeHead(206, { ...headers, 'Content-Range': `bytes ${start}-${end}/${size}`, 'Content-Length': end - start + 1 });
    fs.createReadStream(file, { start, end }).pipe(res);
    return;
  }
  res.writeHead(200, { ...headers, 'Content-Length': size });
  fs.createReadStream(file).pipe(res);
}).listen(PORT, '127.0.0.1', () => {
  console.log(`serve-viewer: ${EVIDENCE} on http://127.0.0.1:${PORT}/`);
});
