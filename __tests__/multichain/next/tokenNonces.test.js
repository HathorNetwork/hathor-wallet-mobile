/**
 * Copyright (c) Hathor Labs and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { describe, it, expect } from '@jest/globals';
import { createNonceStore } from '../../../src/multichain/next/tokenNonces';
import { AUTHORITY_GAP, NonceBeyondReachError } from '../../../src/multichain/next/kit/authority';
import { memoryStorage } from '../fakes/signing';

// The token-creation nonces this device handed out: each rule on its own, against what is on
// disk after it.
describe('the token-creation nonce store', () => {
  const KEY = 'nonces';
  const scan = (highest = -1, held = []) => ({ highest, held });
  const saving = (record) => memoryStorage({ initial: { [KEY]: JSON.stringify(record) } });
  const stored = (storage) => JSON.parse(storage.data[KEY]);

  it('reserves on disk before it answers, and a write that fails gives no nonce', async () => {
    const storage = memoryStorage();
    const store = createNonceStore(storage, KEY);
    await expect(store.reserve(scan())).resolves.toBe(0);
    expect(stored(storage)).toEqual({ reserved: [0], signedFloor: null });
    await expect(store.reserve(scan())).resolves.toBe(1);
    expect(stored(storage).reserved).toEqual([0, 1]);

    const failing = createNonceStore(memoryStorage({ failWrites: true }), KEY);
    await expect(failing.reserve(scan())).rejects.toThrow('disk full');
  });

  it('gives back only the nonce released', async () => {
    const storage = memoryStorage();
    const store = createNonceStore(storage, KEY);
    await store.reserve(scan());
    await store.reserve(scan());
    await store.reserve(scan());
    await store.release(1);
    expect(stored(storage).reserved).toEqual([0, 2]);
    await expect(store.reserve(scan())).resolves.toBe(3);
  });

  it('drops a reserved nonce once the registry lists a token at it, and keeps the others', async () => {
    const storage = saving({ reserved: [0, 1], signedFloor: null });
    const store = createNonceStore(storage, KEY);
    await expect(store.reserve(scan(0, [{ nonce: 0 }]))).resolves.toBe(2);
    expect(stored(storage).reserved).toEqual([1, 2]);
  });

  it('keeps the highest nonce ever signed as a floor that never goes down, and saves it', async () => {
    const storage = memoryStorage();
    const store = createNonceStore(storage, KEY);
    await store.markSigned(5);
    expect(stored(storage).signedFloor).toBe(5);
    await store.markSigned(2);
    expect(stored(storage).signedFloor).toBe(5);
    // Nothing reserved, nothing listed: the floor alone keeps a signed nonce from coming round.
    await expect(store.reserve(scan())).resolves.toBe(6);
  });

  // A wallet restored from its words finds its tokens by scanning AUTHORITY_GAP nonces past the
  // last one the registry lists: a nonce past that window could never be found again.
  it('never hands out a nonce past what a scan from the words can find', async () => {
    const last = createNonceStore(saving({ reserved: [], signedFloor: AUTHORITY_GAP - 2 }), KEY);
    await expect(last.reserve(scan())).resolves.toBe(AUTHORITY_GAP - 1);
    const beyond = createNonceStore(saving({ reserved: [], signedFloor: AUTHORITY_GAP - 1 }), KEY);
    await expect(beyond.reserve(scan())).rejects.toThrow(NonceBeyondReachError);
  });

  it.each([
    ['a set that is no list', { reserved: {}, signedFloor: null }],
    ['no set at all', { signedFloor: null }],
    ['a negative member', { reserved: [-1], signedFloor: null }],
    ['a member that is no whole number', { reserved: [1.5], signedFloor: null }],
    ['a member that is text', { reserved: ['3'], signedFloor: null }],
    ['a floor that is lost', { reserved: [] }],
    ['a floor that is text', { reserved: [], signedFloor: '7' }],
    ['a negative floor', { reserved: [], signedFloor: -2 }],
  ])('stops, rather than guess, on %s', async (label, saved) => {
    const storage = saving(saved);
    const store = createNonceStore(storage, KEY);
    const unreadable = 'The saved token-creation nonces can\'t be read.';
    expect(() => store.read()).toThrow(unreadable);
    await expect(store.reserve(scan())).rejects.toThrow(unreadable);
    await expect(store.release(0)).rejects.toThrow(unreadable);
    await expect(store.markSigned(0)).rejects.toThrow(unreadable);
    // Nothing was written over what couldn't be read.
    expect(stored(storage)).toEqual(saved);
  });
});
