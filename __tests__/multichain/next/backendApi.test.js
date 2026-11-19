/**
 * Copyright (c) Hathor Labs and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import {
  jest, afterEach, beforeEach, describe, it, expect,
} from '@jest/globals';
import {
  BackendError,
  REQUEST_TIMEOUT_MS,
  createBackendApi,
} from '../../../src/multichain/next/backendApi';

// Answers at once with its headers; the body is what the test makes of it.
const answering = (text) => async () => ({ ok: true, status: 200, text });

describe("a call whose answer doesn't come whole", () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });
  afterEach(() => {
    jest.useRealTimers();
  });

  it('is given up when its body stalls past the timeout, as an unreachable backend', async () => {
    const fetchImpl = async (url, { signal }) => answering(() => new Promise((resolve, reject) => {
      signal.addEventListener('abort', () => reject(new Error('aborted')));
    }))();
    let outcome = null;
    createBackendApi('http://backend.test', { fetchImpl }).getConfig()
      .catch((e) => { outcome = e; });
    await jest.advanceTimersByTimeAsync(REQUEST_TIMEOUT_MS);
    expect(outcome).toBeInstanceOf(BackendError);
    expect(outcome.unreachable).toBe(true);
  });

  it('fails as an unreachable backend when its body breaks off', async () => {
    const fetchImpl = answering(async () => { throw new TypeError('Network request failed'); });
    const api = createBackendApi('http://backend.test', { fetchImpl });
    await expect(api.getConfig()).rejects.toMatchObject({ status: 0, unreachable: true });
  });

  it('reads a whole answer as before', async () => {
    const fetchImpl = answering(async () => JSON.stringify({ next: { network_id: 1777 } }));
    const api = createBackendApi('http://backend.test', { fetchImpl });
    await expect(api.getConfig()).resolves.toEqual({ next: { network_id: 1777 } });
  });
});
