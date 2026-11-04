#!/usr/bin/env node
/**
 * Copyright (c) Hathor Labs and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

// A fake Unleash proxy for e2e runs on the local privnet. Debug builds on a local network fetch
// their flags here (see getUnleashUrl in src/sagas/featureToggle.js), and the test run sets them
// through /flags.
//
//   GET  /proxy        what the app fetches: the enabled flags, as the Unleash proxy returns them
//   GET  /flags        { flags, served }: served = the app has fetched the current flags
//   PUT  /flags        merge { "<flag>": true|false, ... } into the flags
//   POST /flags/reset  back to the flags the server started with

const crypto = require('crypto');
const fs = require('fs');
const http = require('http');
const path = require('path');

function createServer(initialFlags, { log = () => {} } = {}) {
  let flags = { ...initialFlags };
  let servedEtag = null;

  const etagOf = () => `"${crypto.createHash('sha1')
    .update(JSON.stringify(Object.entries(flags).sort()))
    .digest('hex')}"`;

  const send = (res, status, body, headers = {}) => {
    res.writeHead(status, { 'Content-Type': 'application/json', ...headers });
    res.end(body === undefined ? undefined : JSON.stringify(body));
  };

  const readJson = (req) => new Promise((resolve, reject) => {
    let raw = '';
    req.on('data', (chunk) => { raw += chunk; });
    req.on('end', () => {
      try {
        resolve(JSON.parse(raw || '{}'));
      } catch (e) {
        reject(e);
      }
    });
  });

  return http.createServer(async (req, res) => {
    const route = `${req.method} ${req.url.split('?')[0]}`;
    log(`${new Date().toISOString()} ${route}`);
    if (route === 'GET /proxy') {
      const etag = etagOf();
      servedEtag = etag;
      if (req.headers['if-none-match'] === etag) {
        send(res, 304, undefined, { ETag: etag });
        return;
      }
      const toggles = Object.entries(flags)
        .filter(([, enabled]) => enabled)
        .map(([name]) => ({
          name, enabled: true, variant: { name: 'disabled', enabled: false }, impressionData: false,
        }));
      send(res, 200, { toggles }, { ETag: etag });
      return;
    }
    if (route === 'GET /flags') {
      send(res, 200, { flags, served: servedEtag === etagOf() });
      return;
    }
    if (route === 'PUT /flags') {
      let changes;
      try {
        changes = await readJson(req);
      } catch (e) {
        send(res, 400, { error: 'body is not JSON' });
        return;
      }
      const invalid = Object.entries(changes).filter(([, v]) => typeof v !== 'boolean');
      if (invalid.length) {
        send(res, 400, { error: `not true or false: ${invalid.map(([name]) => name).join(', ')}` });
        return;
      }
      flags = { ...flags, ...changes };
      send(res, 200, { flags, served: servedEtag === etagOf() });
      return;
    }
    if (route === 'POST /flags/reset') {
      flags = { ...initialFlags };
      send(res, 200, { flags, served: servedEtag === etagOf() });
      return;
    }
    send(res, 404, { error: `no route ${route}` });
  });
}

module.exports = { createServer };

if (require.main === module) {
  const flagsFile = process.env.FLAGS_FILE || path.join(__dirname, 'flags.json');
  const port = Number(process.env.PORT || 18042);
  const initial = JSON.parse(fs.readFileSync(flagsFile, 'utf8'));
  createServer(initial, { log: console.log }).listen(port, '0.0.0.0', () => {
    console.log(`fake Unleash on :${port}, flags from ${flagsFile}`);
  });
}
