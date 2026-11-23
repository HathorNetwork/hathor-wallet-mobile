/**
 * Copyright (c) Hathor Labs and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import {
  afterAll,
  afterEach,
  beforeAll,
  describe,
  test,
  expect,
} from '@jest/globals';
import http from 'http';
import https from 'https';
import net from 'net';

const refused = 'A test tried to reach the network';

// Every test runs behind jestNetworkGuard.js: what a test sends out is refused before it leaves.
describe('a test that tries to reach the network', () => {
  test('is refused, whichever way it goes', () => {
    expect(() => global.fetch('https://example.invalid/')).toThrow(refused);
    expect(() => https.get('https://example.invalid/')).toThrow(refused);
    expect(() => http.request({ hostname: 'example.invalid' })).toThrow(refused);
    expect(() => new global.WebSocket('wss://example.invalid/')).toThrow(refused);
    expect(() => net.connect(443, 'example.invalid')).toThrow(refused);
  });
});

// The opt-in suites that run against a local stack name its services in NEXT_E2E_* variables.
describe('the local stack an opt-in suite names', () => {
  let server;
  let port;
  const answerOf = (url) => new Promise((resolve, reject) => {
    http.get(url, (response) => {
      let body = '';
      response.on('data', (chunk) => { body += chunk; });
      response.on('end', () => resolve(body));
    }).on('error', reject);
  });

  beforeAll(async () => {
    server = http.createServer((request, response) => response.end('the local backend'));
    await new Promise((resolve) => { server.listen(0, '127.0.0.1', resolve); });
    ({ port } = server.address());
  });
  afterAll(() => new Promise((resolve) => { server.close(resolve); }));
  afterEach(() => {
    delete process.env.NEXT_E2E_BACKEND;
  });

  test('is reached once a variable names it on this machine, by http and fetch', async () => {
    process.env.NEXT_E2E_BACKEND = `http://127.0.0.1:${port}`;

    await expect(answerOf(`http://127.0.0.1:${port}/v1/config`)).resolves.toBe('the local backend');
    const response = await global.fetch(`http://127.0.0.1:${port}/v1/config`);
    await expect(response.text()).resolves.toBe('the local backend');
  });

  test('stays shut to another port, to another host, and with no variable', () => {
    process.env.NEXT_E2E_BACKEND = `http://127.0.0.1:${port}`;
    expect(() => http.get(`http://127.0.0.1:${port + 1}/`)).toThrow(refused);
    expect(() => global.fetch(`http://example.invalid:${port}/`)).toThrow(refused);
    expect(() => net.connect(port + 1, '127.0.0.1')).toThrow(refused);

    // A variable that names another host opens nothing, not even this machine.
    process.env.NEXT_E2E_BACKEND = `http://example.invalid:${port}`;
    expect(() => http.get(`http://example.invalid:${port}/`)).toThrow(refused);
    expect(() => http.get(`http://127.0.0.1:${port}/`)).toThrow(refused);

    delete process.env.NEXT_E2E_BACKEND;
    expect(() => http.get(`http://127.0.0.1:${port}/`)).toThrow(refused);
  });
});
