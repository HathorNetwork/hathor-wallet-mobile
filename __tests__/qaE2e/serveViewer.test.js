/**
 * @jest-environment node
 *
 * Copyright (c) Hathor Labs and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { spawn } from 'child_process';
import fs from 'fs';
import net from 'net';
import os from 'os';
import path from 'path';
import { afterAll, beforeAll, describe, expect, it } from '@jest/globals';

const SERVER = path.resolve(__dirname, '../../QA/e2e/bin/serve-viewer.js');

let dir;
let server;
let base;

const freePort = () => new Promise((resolve) => {
  const probe = net.createServer().listen(0, '127.0.0.1', () => {
    const { port } = probe.address();
    probe.close(() => resolve(port));
  });
});

// The server serves the evidence dir beside its own bin/, so a copy of it serves a scratch one.
beforeAll(async () => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'serve-viewer-'));
  fs.mkdirSync(path.join(dir, 'bin'));
  fs.copyFileSync(SERVER, path.join(dir, 'bin', 'serve-viewer.js'));
  ['run/viewer.html', 'run/import/screen.mp4', 'run/send-1/screen.mp4', 'run/onboard/screen.mp4', 'run/app.seed'].forEach((file) => {
    const full = path.join(dir, 'evidence', file);
    fs.mkdirSync(path.dirname(full), { recursive: true });
    fs.writeFileSync(full, 'x');
  });
  const port = await freePort();
  base = `http://127.0.0.1:${port}`;
  server = spawn('node', [path.join(dir, 'bin', 'serve-viewer.js'), String(port)]);
  await new Promise((resolve) => { server.stdout.once('data', resolve); });
});

afterAll(() => {
  server.kill();
  fs.rmSync(dir, { recursive: true, force: true });
});

const status = async (url) => (await fetch(`${base}${url}`)).status;

describe('serve-viewer', () => {
  it.each(['/run/viewer.html', '/run/import/screen.mp4', '/run/send-1/screen.mp4'])('serves %s', async (url) => {
    expect(await status(url)).toBe(200);
  });

  // Runs recorded before onboarding stopped being recorded show the seed there.
  it.each([
    '/run/onboard/screen.mp4',
    '/run/send-1/../onboard/screen.mp4',
    '/run/send-1/%2e%2e/onboard/screen.mp4',
    '/run/send-1/..%2fonboard/screen.mp4',
    '/run/%6fnboard/screen.mp4',
    '/run/app.seed',
  ])('does not serve %s', async (url) => {
    expect(await status(url)).toBe(404);
  });
});
