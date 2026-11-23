/**
 * Copyright (c) Hathor Labs and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { jest, describe, test, expect, afterEach } from '@jest/globals';

// Only the passkey is faked: its sheet gives the words. Everything the unlock derives from them is
// real, so the test counts the BIP39 stretches (PBKDF2, seconds of JS on a phone) it really runs:
// wallet-lib stretches in getXPrivKeyFromSeed (getXPubKeyFromSeed derives through it), the Hathor
// Next kit in mnemonicToSeed. A passkey wallet keeps no secret on the device: what an unlock
// writes is listed whole, so a root, an account node or a key that found its way into storage
// shows.
jest.mock('../../src/passkey/passkeyService', () => ({
  ...jest.requireActual('../../src/passkey/passkeyService'),
  signInWalletWordsFromPasskey: jest.fn(),
  isPasskeyCancel: jest.fn(() => false),
}));
jest.mock('../../src/passkey/walletServiceRegistration', () => ({
  walletServiceRegistrationForUnlock: jest.fn(() => undefined),
  finishWalletServiceRegistration: jest.fn(),
}));

/* eslint-disable import/first */
import React from 'react';
import { Text } from 'react-native';
import { act, create } from 'react-test-renderer';
import { Provider } from 'react-redux';
import { legacy_createStore as createStore, applyMiddleware } from 'redux';
import { walletUtils } from '@hathor/wallet-lib';
import { reducer } from '../../src/reducers/reducer';
import {
  featureToggleInitialized,
  setFeatureToggles,
  types,
  unlockScreen,
} from '../../src/actions';
import { MULTICHAIN_FEATURE_TOGGLE, multichainKeyMap } from '../../src/constants';
import { STORE } from '../../src/store';
import PasskeyLockScreen from '../../src/screens/PasskeyLockScreen';
import { signInWalletWordsFromPasskey } from '../../src/passkey/passkeyService';
import { derivePasskeyXpub } from '../../src/passkey/passkeySigner';
import {
  clearPasskeyScanKey,
  derivePasskeyShieldedKeys,
  getPasskeyScanKey,
  supportsPasskeyShielded,
} from '../../src/passkey/shieldedKeys';
import { pendingUnlockDerivation } from '../../src/multichain/keys';
import { setNextClient } from '../../src/multichain/nextClient';
import * as kitKeys from '../../src/multichain/next/kit/keys';
import { createBackendNextClient } from '../../src/multichain/next/backendClient';
/* eslint-enable import/first */

// Real BIP39 stretches, seconds each on a loaded machine: well past jest's default 5 s.
jest.setTimeout(30000);

// The loaded wallet, and another one whose passkey could be picked on the sheet.
const WORDS = `${'abandon '.repeat(23)}art`;
const OTHER_WORDS = walletUtils.generateWalletWords(Buffer.alloc(32, 7));
const XPUB = derivePasskeyXpub(WORDS);
// What the words give, derived apart from any ceremony; null when the bundled wallet-lib can't.
const SHIELDED = derivePasskeyShieldedKeys(WORDS);
// What an unlock writes to the wallet's metadata: the shielded xpubs, which wallets created
// before shielded outputs don't have yet.
const META_WRITES = SHIELDED ? [[{ shieldedXpubs: SHIELDED.shieldedXpubs }]] : [];
// The unlock's own stretches with the flag off: the passkey check, and the shielded keys.
const STRETCHES_BEFORE = 1 + (supportsPasskeyShielded() ? 1 : 0);

// No connect runs here; a request would be refused.
const newClient = () => createBackendNextClient({
  fetchImpl: () => { throw new Error('no network in this test'); },
  WebSocketImpl: null,
});

let mounted = null;

/**
 * Unlocks the passkey wallet of WORDS with the passkey of `words`. `usedNext`: the wallet used
 * Hathor Next before, so the unlock derives its keys while the flag is on.
 */
async function unlock({ multichain, usedNext, words = WORDS }) {
  jest.spyOn(STORE, 'getWalletMeta').mockReturnValue({
    walletType: 'passkey', xpub: XPUB, credentialId: 'credential',
  });
  const getItem = STORE.getItem.bind(STORE);
  jest.spyOn(STORE, 'getItem').mockImplementation((key) => {
    if (key === multichainKeyMap.next) {
      return usedNext ? { pubB: 'saved' } : null;
    }
    return getItem(key);
  });
  const writes = {
    setItem: jest.spyOn(STORE, 'setItem').mockImplementation(() => {}),
    setItemAsync: jest.spyOn(STORE, 'setItemAsync').mockResolvedValue(),
    removeItem: jest.spyOn(STORE, 'removeItem').mockImplementation(() => {}),
    removeItemAsync: jest.spyOn(STORE, 'removeItemAsync').mockResolvedValue(),
    updateWalletMeta: jest.spyOn(STORE, 'updateWalletMeta').mockResolvedValue(),
  };
  signInWalletWordsFromPasskey.mockResolvedValue({ words, credentialId: 'credential' });
  clearPasskeyScanKey();
  const client = newClient();
  setNextClient(client);
  const actions = [];
  const recordActions = () => (next) => (action) => {
    actions.push(action);
    return next(action);
  };
  const store = createStore(reducer, applyMiddleware(recordActions));
  store.dispatch(setFeatureToggles({ [MULTICHAIN_FEATURE_TOGGLE]: multichain }));
  store.dispatch(featureToggleInitialized());
  actions.length = 0;

  const walletLibStretch = jest.spyOn(walletUtils, 'getXPrivKeyFromSeed');
  const kitStretch = jest.spyOn(kitKeys, 'mnemonicToSeed');
  await act(async () => {
    mounted = create(<Provider store={store}><PasskeyLockScreen /></Provider>);
  });
  await act(async () => {
    await pendingUnlockDerivation();
  });
  const stretches = walletLibStretch.mock.calls.length + kitStretch.mock.calls.length;
  walletLibStretch.mockRestore();
  kitStretch.mockRestore();
  return {
    client,
    stretches,
    writes: Object.fromEntries(Object.entries(writes).map(([name, spy]) => [name, spy.mock.calls])),
    types: actions.map((action) => action.type),
    texts: mounted.root.findAllByType(Text).map((text) => [text.props.children].flat().join('')),
  };
}

/** Every write of an unlock that writes `setItem` and the shielded xpubs, and nothing else. */
const only = (setItem) => ({
  setItem,
  setItemAsync: [],
  removeItem: [],
  removeItemAsync: [],
  updateWalletMeta: META_WRITES,
});

afterEach(async () => {
  if (mounted) {
    await act(async () => { mounted.unmount(); });
    mounted = null;
  }
  setNextClient(null);
  clearPasskeyScanKey();
  jest.restoreAllMocks();
  jest.clearAllMocks();
});

describe('a passkey unlock stretches the words', () => {
  test('once with the multichain flag on, Hathor Next keys and shielded keys included', async () => {
    const { client, stretches, writes } = await unlock({ multichain: true, usedNext: true });

    expect(stretches).toBe(1);
    expect(client.hasKeys()).toBe(true);
    // The keys are the ones the words give, and what is stored is public: the spend key.
    const fromWords = await newClient().prepareKeys({ words: WORDS });
    expect(writes).toEqual(only([[multichainKeyMap.next, { pubB: fromWords.pubB }]]));
    expect(getPasskeyScanKey()).toBe(SHIELDED?.scanXPrivKey ?? null);
  });

  test('once with the flag on for a wallet that never used Hathor Next', async () => {
    const { client, stretches, writes } = await unlock({ multichain: true, usedNext: false });

    expect(stretches).toBe(1);
    expect(client.hasKeys()).toBe(false);
    expect(writes).toEqual(only([]));
    expect(getPasskeyScanKey()).toBe(SHIELDED?.scanXPrivKey ?? null);
  });

  test('as before with the flag off: no Hathor Next keys, nothing shared', async () => {
    const { client, stretches, writes } = await unlock({ multichain: false, usedNext: true });

    expect(stretches).toBe(STRETCHES_BEFORE);
    expect(client.hasKeys()).toBe(false);
    expect(writes).toEqual(only([]));
    expect(getPasskeyScanKey()).toBe(SHIELDED?.scanXPrivKey ?? null);
  });
});

// The refusal a device makes: the account xpub of another wallet's words, whichever way the
// ceremony derives it, is not the loaded wallet's. It comes before anything is derived for it.
describe('a passkey of another wallet', () => {
  test.each([
    ['on', true],
    ['off', false],
  ])('unlocks nothing and derives no key, with the multichain flag %s', async (name, multichain) => {
    const refused = await unlock({ multichain, usedNext: true, words: OTHER_WORDS });

    expect(refused.texts.join('\n')).toContain('This passkey opens a different wallet.');
    expect(refused.types).not.toContain(unlockScreen().type);
    expect(refused.types).not.toContain(types.START_WALLET_REQUESTED);
    expect(refused.types).not.toContain(types.MULTICHAIN_NEXT_KEYS_DERIVED);
    // No Hathor Next key, no shielded key, nothing stored: the check alone stretched the words.
    expect(refused.client.hasKeys()).toBe(false);
    expect(getPasskeyScanKey()).toBeNull();
    expect(refused.writes).toEqual({ ...only([]), updateWalletMeta: [] });
    expect(refused.stretches).toBe(1);
  });
});
