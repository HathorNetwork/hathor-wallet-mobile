/**
 * Copyright (c) Hathor Labs and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { jest, describe, test, expect, beforeEach, afterEach } from '@jest/globals';
import { multichainKeyMap } from '../../src/constants';
import { STORE } from '../../src/store';
import { prepareNextKeysWithPin } from '../../src/multichain/keys';
import { setNextClient } from '../../src/multichain/nextClient';
import { createBackendNextClient } from '../../src/multichain/next/backendClient';
import * as kitKeys from '../../src/multichain/next/kit/keys';
import derivation from './next/fixtures/derivation.json';

const WORDS = derivation.mnemonic;
const PIN = '123456';

let client;
beforeEach(() => {
  STORE.removeItem(multichainKeyMap.nextSecret);
  STORE.removeItem(multichainKeyMap.next);
  client = createBackendNextClient({ WebSocketImpl: null });
  setNextClient(client);
});

afterEach(() => {
  setNextClient(null);
  jest.restoreAllMocks();
});

describe('the Hathor Next keys at an unlock with the PIN', () => {
  test('stretch the words once, then come from the secret the PIN decrypts', async () => {
    const wordsOf = jest.fn(async () => WORDS);
    const stretch = jest.spyOn(kitKeys, 'mnemonicToSeed');
    await prepareNextKeysWithPin(PIN, wordsOf);
    const { pubB } = STORE.getItem(multichainKeyMap.next);
    expect(stretch).toHaveBeenCalledTimes(1);

    client.forgetKeys();
    await prepareNextKeysWithPin(PIN, wordsOf);
    expect(client.hasKeys()).toBe(true);
    expect(STORE.getItem(multichainKeyMap.next).pubB).toBe(pubB);
    // The second unlock read no words, and stretched nothing.
    expect(wordsOf).toHaveBeenCalledTimes(1);
    expect(stretch).toHaveBeenCalledTimes(1);
  });

  test('keep the secret encrypted: neither it nor the words are stored in the clear', async () => {
    await prepareNextKeysWithPin(PIN, async () => WORDS);
    const stored = JSON.stringify(STORE.getItem(multichainKeyMap.nextSecret));
    expect(stored).not.toContain(`${WORDS.split(' ')[0]} `);
    expect(stored).not.toContain(PIN);
    expect(STORE.getItem(multichainKeyMap.nextSecret).secret).toMatchObject({
      data: expect.any(String), hash: expect.any(String),
    });
  });

  test('come from the words again after a PIN change, and are saved with the new PIN', async () => {
    await prepareNextKeysWithPin(PIN, async () => WORDS);
    const wordsOf = jest.fn(async () => WORDS);
    client.forgetKeys();
    await prepareNextKeysWithPin('654321', wordsOf);
    expect(wordsOf).toHaveBeenCalledWith('654321');
    expect(client.hasKeys()).toBe(true);
    // The next unlock with the new PIN reads no words.
    client.forgetKeys();
    await prepareNextKeysWithPin('654321', wordsOf);
    expect(wordsOf).toHaveBeenCalledTimes(1);
  });
});
