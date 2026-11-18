/**
 * @jest-environment node
 *
 * Copyright (c) Hathor Labs and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { afterEach, describe, expect, it } from '@jest/globals';
import { createServer } from '../../QA/e2e/unleash/server';

let server;
let base;

async function start(flags) {
  server = createServer(flags);
  await new Promise((resolve) => { server.listen(0, '127.0.0.1', resolve); });
  base = `http://127.0.0.1:${server.address().port}`;
}

afterEach(async () => {
  await new Promise((resolve) => { server.close(resolve); });
});

const proxy = (headers = {}) => fetch(`${base}/proxy?appName=wallet-mobile-android`, { headers });
const enabledNames = async (response) => (await response.json()).toggles
  .filter((t) => t.enabled).map((t) => t.name).sort();
const setFlags = (body) => fetch(`${base}/flags`, {
  method: 'PUT',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(body),
});

describe('fake Unleash', () => {
  it('serves the enabled flags the way the Unleash proxy does', async () => {
    await start({ 'a.rollout': true, 'b.rollout': false });
    const response = await proxy();
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.toggles).toEqual([
      { name: 'a.rollout', enabled: true, variant: { name: 'disabled', enabled: false }, impressionData: false },
    ]);
  });

  it('serves a flag change on the next fetch', async () => {
    await start({ 'a.rollout': true, 'b.rollout': false });
    const changed = await setFlags({ 'a.rollout': false, 'b.rollout': true });
    expect(changed.status).toBe(200);
    expect(await enabledNames(await proxy())).toEqual(['b.rollout']);
  });

  it('answers 304 while nothing changed, so the app keeps its toggles', async () => {
    await start({ 'a.rollout': true });
    const first = await proxy();
    const etag = first.headers.get('ETag');
    expect(etag).toBeTruthy();
    expect((await proxy({ 'If-None-Match': etag })).status).toBe(304);
    await setFlags({ 'a.rollout': false });
    expect((await proxy({ 'If-None-Match': etag })).status).toBe(200);
  });

  it('reports whether the app has fetched the current flags', async () => {
    await start({ 'a.rollout': true });
    const state = async () => (await fetch(`${base}/flags`)).json();
    expect((await state()).served).toBe(false);
    await proxy();
    expect((await state()).served).toBe(true);
    await setFlags({ 'a.rollout': false });
    expect(await state()).toMatchObject({ flags: { 'a.rollout': false }, served: false });
  });

  it('refuses a flag value that is not true or false', async () => {
    await start({ 'a.rollout': true });
    expect((await setFlags({ 'a.rollout': 'on' })).status).toBe(400);
    expect(await enabledNames(await proxy())).toEqual(['a.rollout']);
  });

  it('goes back to the flags it started with on reset', async () => {
    await start({ 'a.rollout': true });
    await setFlags({ 'a.rollout': false, 'c.rollout': true });
    await fetch(`${base}/flags/reset`, { method: 'POST' });
    expect((await (await fetch(`${base}/flags`)).json()).flags).toEqual({ 'a.rollout': true });
  });
});
