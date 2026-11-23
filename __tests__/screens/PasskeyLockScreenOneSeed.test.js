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
// Next kit in mnemonicToSeed.
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
import { act, create } from 'react-test-renderer';
import { Provider } from 'react-redux';
import { legacy_createStore as createStore } from 'redux';
import { walletUtils } from '@hathor/wallet-lib';
import { reducer } from '../../src/reducers/reducer';
import { featureToggleInitialized, setFeatureToggles } from '../../src/actions';
import { MULTICHAIN_FEATURE_TOGGLE, multichainKeyMap } from '../../src/constants';
import { STORE } from '../../src/store';
import PasskeyLockScreen from '../../src/screens/PasskeyLockScreen';
import { signInWalletWordsFromPasskey } from '../../src/passkey/passkeyService';
import { derivePasskeyXpub } from '../../src/passkey/passkeySigner';
import { derivePasskeyShieldedKeys, supportsPasskeyShielded } from '../../src/passkey/shieldedKeys';
import { pendingUnlockDerivation } from '../../src/multichain/keys';
import { setNextClient } from '../../src/multichain/nextClient';
import * as kitKeys from '../../src/multichain/next/kit/keys';
import { createBackendNextClient } from '../../src/multichain/next/backendClient';
/* eslint-enable import/first */

const WORDS = `${'abandon '.repeat(23)}art`;
const XPUB = derivePasskeyXpub(WORDS);
const SHIELDED_XPUBS = derivePasskeyShieldedKeys(WORDS)?.shieldedXpubs;
// The unlock's own stretches with the flag off: the passkey check, and the shielded keys.
const STRETCHES_BEFORE = 1 + (supportsPasskeyShielded() ? 1 : 0);

// No connect runs here; a request would be refused.
const newClient = () => createBackendNextClient({
  fetchImpl: () => { throw new Error('no network in this test'); },
  WebSocketImpl: null,
});

let mounted = null;

/**
 * Unlocks a passkey wallet. `usedNext`: the wallet used Hathor Next before, so the unlock derives
 * its keys while the flag is on.
 */
async function unlock({ multichain, usedNext }) {
  jest.spyOn(STORE, 'getWalletMeta').mockReturnValue({
    walletType: 'passkey', xpub: XPUB, credentialId: 'credential',
  });
  const updateWalletMeta = jest.spyOn(STORE, 'updateWalletMeta').mockResolvedValue();
  const getItem = STORE.getItem.bind(STORE);
  jest.spyOn(STORE, 'getItem').mockImplementation((key) => {
    if (key === multichainKeyMap.next) {
      return usedNext ? { pubB: 'saved' } : null;
    }
    return getItem(key);
  });
  jest.spyOn(STORE, 'setItem').mockImplementation(() => {});
  signInWalletWordsFromPasskey.mockResolvedValue({ words: WORDS, credentialId: 'credential' });
  const client = newClient();
  setNextClient(client);
  const store = createStore(reducer);
  store.dispatch(setFeatureToggles({ [MULTICHAIN_FEATURE_TOGGLE]: multichain }));
  store.dispatch(featureToggleInitialized());

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
  return { client, stretches, updateWalletMeta };
}

describe('a passkey unlock stretches the words', () => {
  afterEach(async () => {
    if (mounted) {
      await act(async () => { mounted.unmount(); });
      mounted = null;
    }
    setNextClient(null);
    jest.restoreAllMocks();
    jest.clearAllMocks();
  });

  test('once with the multichain flag on, Hathor Next keys and shielded keys included', async () => {
    const { client, stretches, updateWalletMeta } = await unlock({
      multichain: true, usedNext: true,
    });

    expect(stretches).toBe(1);
    expect(client.hasKeys()).toBe(true);
    // The keys are the ones the words give.
    const fromWords = await newClient().prepareKeys({ words: WORDS });
    expect(STORE.setItem).toHaveBeenCalledWith(multichainKeyMap.next, expect.objectContaining({
      pubB: fromWords.pubB,
    }));
    if (SHIELDED_XPUBS) {
      expect(updateWalletMeta).toHaveBeenCalledWith({ shieldedXpubs: SHIELDED_XPUBS });
    }
  });

  test('once with the flag on for a wallet that never used Hathor Next', async () => {
    const { client, stretches } = await unlock({ multichain: true, usedNext: false });

    expect(stretches).toBe(1);
    expect(client.hasKeys()).toBe(false);
  });

  test('as before with the flag off: no Hathor Next keys, nothing shared', async () => {
    const { client, stretches, updateWalletMeta } = await unlock({
      multichain: false, usedNext: true,
    });

    expect(stretches).toBe(STRETCHES_BEFORE);
    expect(client.hasKeys()).toBe(false);
    if (SHIELDED_XPUBS) {
      expect(updateWalletMeta).toHaveBeenCalledWith({ shieldedXpubs: SHIELDED_XPUBS });
    }
  });
});
