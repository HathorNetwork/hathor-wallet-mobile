/**
 * Copyright (c) Hathor Labs and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { jest, describe, test, expect, beforeEach, afterEach } from '@jest/globals';
import { cryptoUtils } from '@hathor/wallet-lib';
import { multichainKeyMap } from '../../src/constants';
import { STORE } from '../../src/store';
import { prepareNextKeysWithPin } from '../../src/multichain/keys';
import { changeNextSecretPin, changePinOnAccessData } from '../../src/utils';
import { setNextClient } from '../../src/multichain/nextClient';
import { createBackendNextClient } from '../../src/multichain/next/backendClient';
import * as kitKeys from '../../src/multichain/next/kit/keys';
import derivation from './next/fixtures/derivation.json';

const WORDS = derivation.mnemonic;
const PIN = '123456';
// The wallet's own public key on Hathor Network, which the saved secret is kept with.
const XPUB = 'xpub-of-this-wallet';

let client;
beforeEach(() => {
  STORE.removeItem(multichainKeyMap.nextSecret);
  STORE.removeItem(multichainKeyMap.next);
  client = createBackendNextClient({ WebSocketImpl: null });
  setNextClient(client);
  jest.spyOn(STORE, 'getAvailableAccessData')
    .mockResolvedValue({ accessData: { xpubkey: XPUB }, version: 1 });
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

describe('the Hathor Next secret kept on the device', () => {
  test('moves to the new PIN with the words: the old PIN opens it no more', async () => {
    await prepareNextKeysWithPin(PIN, async () => WORDS);
    changeNextSecretPin(PIN, '654321');
    const { secret } = STORE.getItem(multichainKeyMap.nextSecret);
    expect(() => cryptoUtils.decryptData(secret, PIN)).toThrow();
    const wordsOf = jest.fn(async () => WORDS);
    client.forgetKeys();
    await prepareNextKeysWithPin('654321', wordsOf);
    expect(client.hasKeys()).toBe(true);
    expect(wordsOf).not.toHaveBeenCalled();
  });

  test('moves when the wallet\'s PIN changes, and to the password safe biometry puts it under', async () => {
    await prepareNextKeysWithPin(PIN, async () => WORDS);
    // The wallet's storage takes the change: changePinOnAccessData moves the words there.
    const storage = {
      checkPin: async () => true,
      checkPassword: async () => true,
      changePin: async () => {},
      changePassword: async () => {},
    };
    const password = 'a'.repeat(64);
    await expect(changePinOnAccessData(storage, PIN, password)).resolves.toBe(true);
    const { secret } = STORE.getItem(multichainKeyMap.nextSecret);
    expect(() => cryptoUtils.decryptData(secret, PIN)).toThrow();
    expect(cryptoUtils.decryptData(secret, password)).toMatch(/^[0-9a-f]{64}$/);
  });

  test('is dropped when the old PIN doesn\'t open it, and nothing happens without one', () => {
    STORE.setItem(multichainKeyMap.nextSecret, {
      xpub: XPUB, pubB: 'ab', secret: cryptoUtils.encryptData('cd'.repeat(32), '999999'),
    });
    changeNextSecretPin(PIN, '654321');
    expect(STORE.getItem(multichainKeyMap.nextSecret)).toBeNull();
    expect(() => changeNextSecretPin(PIN, '654321')).not.toThrow();
  });

  test('is derived again when it is another wallet\'s', async () => {
    await prepareNextKeysWithPin(PIN, async () => WORDS);
    STORE.getAvailableAccessData.mockResolvedValue({ accessData: { xpubkey: 'xpub-other' } });
    const wordsOf = jest.fn(async () => WORDS);
    client.forgetKeys();
    await prepareNextKeysWithPin(PIN, wordsOf);
    expect(wordsOf).toHaveBeenCalledTimes(1);
    expect(STORE.getItem(multichainKeyMap.nextSecret).xpub).toBe('xpub-other');
  });

  test('is derived again when its secret doesn\'t give the public key kept with it', async () => {
    await prepareNextKeysWithPin(PIN, async () => WORDS);
    const saved = STORE.getItem(multichainKeyMap.nextSecret);
    STORE.setItem(multichainKeyMap.nextSecret, {
      ...saved, secret: cryptoUtils.encryptData('01'.padEnd(64, '0'), PIN),
    });
    const wordsOf = jest.fn(async () => WORDS);
    client.forgetKeys();
    await prepareNextKeysWithPin(PIN, wordsOf);
    expect(wordsOf).toHaveBeenCalledTimes(1);
    expect(STORE.getItem(multichainKeyMap.next).pubB).toBe(saved.pubB);
  });
});
