/**
 * Copyright (c) Hathor Labs and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { jest, describe, test, expect, beforeEach, afterEach } from '@jest/globals';

// The unlock ceremony: it hands the test's words to the `onWords` hook it is given.
jest.mock('../../src/passkey/passkeySigner', () => ({
  ...jest.requireActual('../../src/passkey/passkeySigner'),
  verifyPasskeyForUnlock: jest.fn(),
}));
jest.mock('../../src/passkey/shieldedKeys', () => ({
  rememberPasskeyShieldedKeys: jest.fn(),
}));
jest.mock('../../src/passkey/walletServiceRegistration', () => ({
  walletServiceRegistrationForUnlock: jest.fn(),
  finishWalletServiceRegistration: jest.fn(),
}));

/* eslint-disable import/first */
import React from 'react';
import { act, create } from 'react-test-renderer';
import { Provider } from 'react-redux';
import { legacy_createStore as createStore, applyMiddleware } from 'redux';
import { reducer } from '../../src/reducers/reducer';
import {
  featureToggleInitialized,
  setFeatureToggles,
  setWallet,
  shieldedViewUnlockRequested,
  types,
  unlockScreen,
} from '../../src/actions';
import { MULTICHAIN_FEATURE_TOGGLE, SHIELDED_UNLOCK_SOURCE } from '../../src/constants';
import * as multichainKeys from '../../src/multichain/keys';
import { FEATURE_TOGGLES_LAST_KNOWN_VALUES_KEY, STORE } from '../../src/store';
import PasskeyLockScreen from '../../src/screens/PasskeyLockScreen';
import { verifyPasskeyForUnlock } from '../../src/passkey/passkeySigner';
import { rememberPasskeyShieldedKeys } from '../../src/passkey/shieldedKeys';
import {
  finishWalletServiceRegistration,
  walletServiceRegistrationForUnlock,
} from '../../src/passkey/walletServiceRegistration';
/* eslint-enable import/first */

const WORDS = 'passkey words';
// The root the ceremony derives from the words when it is asked to share it.
const ROOT = { root: 'of the passkey words' };

let mounted = null;

/**
 * Renders the lock screen, which runs the unlock ceremony as it mounts. `toggles`: what Unleash
 * answered before the unlock; left out, it has not answered yet. `during`: what Unleash answers
 * while the passkey sheet is up, before the words arrive.
 */
async function render({ wallet = null, toggles = null, during = null } = {}) {
  const actions = [];
  const recordActions = () => (next) => (action) => {
    actions.push(action);
    return next(action);
  };
  const store = createStore(reducer, applyMiddleware(recordActions));
  if (wallet) {
    store.dispatch(setWallet(wallet));
  }
  const answer = (flags) => {
    store.dispatch(setFeatureToggles(flags));
    store.dispatch(featureToggleInitialized());
  };
  if (toggles) {
    answer(toggles);
  }
  if (during) {
    const ceremony = verifyPasskeyForUnlock.getMockImplementation();
    verifyPasskeyForUnlock.mockImplementation(async (params) => {
      answer(during);
      return ceremony(params);
    });
  }
  actions.length = 0;
  await act(async () => {
    mounted = create(<Provider store={store}><PasskeyLockScreen /></Provider>);
  });
  return { actions, typesOf: () => actions.map((action) => action.type) };
}

describe('PasskeyLockScreen', () => {
  beforeEach(() => {
    jest.spyOn(STORE, 'getWalletMeta').mockReturnValue({ walletType: 'passkey', xpub: 'xpub' });
    // As the real ceremony: the root goes to onWords only when the unlock asks for it.
    verifyPasskeyForUnlock.mockImplementation(async ({ onWords, shareRoot }) => (
      shareRoot ? onWords(WORDS, ROOT) : onWords(WORDS)
    ));
    walletServiceRegistrationForUnlock.mockReturnValue(undefined);
  });

  afterEach(async () => {
    if (mounted) {
      await act(async () => { mounted.unmount(); });
      mounted = null;
    }
    STORE.removeItem(FEATURE_TOGGLES_LAST_KNOWN_VALUES_KEY);
    jest.restoreAllMocks();
    jest.clearAllMocks();
  });

  // The unlock ceremony also derives the shielded keys: no second Face ID.
  test('derives the shielded keys in the unlock ceremony, and still registers the wallet', async () => {
    const registration = { prepared: true };
    const register = jest.fn(() => registration);
    walletServiceRegistrationForUnlock.mockReturnValue(register);

    await render();

    // No root with the multichain flag off: they derive their own, as before.
    expect(rememberPasskeyShieldedKeys).toHaveBeenCalledWith(WORDS, undefined);
    expect(register).toHaveBeenCalledWith(WORDS);
    expect(finishWalletServiceRegistration).toHaveBeenCalledWith(registration);
  });

  test('derives them when the wallet registers nothing too', async () => {
    await render();

    expect(rememberPasskeyShieldedKeys).toHaveBeenCalledWith(WORDS, undefined);
    expect(finishWalletServiceRegistration).toHaveBeenCalledWith(undefined);
  });

  // The same ceremony gives Hathor Next's keys, only while the multichain flag is on.
  test.each([
    ['on', { [MULTICHAIN_FEATURE_TOGGLE]: true }, true],
    ['off', {}, false],
  ])('derives the Hathor Next keys only with the multichain flag on (%s)', async (name, toggles, on) => {
    const derive = jest.spyOn(multichainKeys, 'prepareNextKeysAtUnlock')
      .mockResolvedValue(null);
    const { typesOf } = await render({ toggles });
    // With the flag off, nothing is derived and no "keys derived" action goes out.
    if (on) {
      expect(derive).toHaveBeenCalledWith(WORDS, true, ROOT);
    } else {
      expect(derive).not.toHaveBeenCalled();
    }
    expect(typesOf().includes(types.MULTICHAIN_NEXT_KEYS_DERIVED)).toBe(on);
  });

  // With the flag on, the words are stretched once: the root that checks the passkey also gives
  // the shielded keys and Hathor Next's. With it off, the ceremony shares nothing.
  test.each([
    ['on', { [MULTICHAIN_FEATURE_TOGGLE]: true }, true],
    ['off', { [MULTICHAIN_FEATURE_TOGGLE]: false }, false],
    ['unknown', null, false],
  ])('shares the ceremony\'s root only with the multichain flag on (%s)', async (name, toggles, on) => {
    jest.spyOn(multichainKeys, 'prepareNextKeysAtUnlock').mockResolvedValue(null);
    await render({ toggles });

    expect(verifyPasskeyForUnlock).toHaveBeenCalledTimes(1);
    expect(verifyPasskeyForUnlock.mock.calls[0][0].shareRoot).toBe(on);
    expect(rememberPasskeyShieldedKeys).toHaveBeenCalledWith(WORDS, on ? ROOT : undefined);
    if (on) {
      expect(multichainKeys.prepareNextKeysAtUnlock).toHaveBeenCalledWith(WORDS, true, ROOT);
    }
  });

  // The usual start of the app: the lock screen comes before Unleash answers, and the flag is the
  // one this device saved from Unleash's last answer. The ceremony shares its root by it.
  test.each([
    ['on', { [MULTICHAIN_FEATURE_TOGGLE]: true }, true],
    ['off', { [MULTICHAIN_FEATURE_TOGGLE]: false }, false],
    ['of another flag alone', { 'another.rollout': true }, false],
  ])('before Unleash answers, shares the root by the flag this device saved (%s)', async (name, saved, on) => {
    STORE.setItem(FEATURE_TOGGLES_LAST_KNOWN_VALUES_KEY, saved);
    jest.spyOn(multichainKeys, 'prepareNextKeysAtUnlock').mockResolvedValue(null);

    const { typesOf } = await render();

    expect(verifyPasskeyForUnlock).toHaveBeenCalledTimes(1);
    expect(verifyPasskeyForUnlock.mock.calls[0][0].shareRoot).toBe(on);
    expect(rememberPasskeyShieldedKeys).toHaveBeenCalledWith(WORDS, on ? ROOT : undefined);
    if (on) {
      expect(multichainKeys.prepareNextKeysAtUnlock).toHaveBeenCalledWith(WORDS, true, ROOT);
    } else {
      expect(multichainKeys.prepareNextKeysAtUnlock).not.toHaveBeenCalled();
    }
    expect(typesOf().includes(types.MULTICHAIN_NEXT_KEYS_DERIVED)).toBe(on);
  });

  // The unlock reads the flag twice: as the ceremony starts, to share its root, and as the words
  // arrive, to derive the Hathor Next keys. Unleash can answer in between, and the keys follow the
  // flag as the app knows it when the words arrive.
  test('with the flag turned off during the ceremony: no Hathor Next keys, though the root was shared', async () => {
    jest.spyOn(multichainKeys, 'prepareNextKeysAtUnlock').mockResolvedValue(null);

    const { typesOf } = await render({
      toggles: { [MULTICHAIN_FEATURE_TOGGLE]: true },
      during: { [MULTICHAIN_FEATURE_TOGGLE]: false },
    });

    expect(verifyPasskeyForUnlock.mock.calls[0][0].shareRoot).toBe(true);
    // The root was derived, so the shielded keys still come from it.
    expect(rememberPasskeyShieldedKeys).toHaveBeenCalledWith(WORDS, ROOT);
    expect(multichainKeys.prepareNextKeysAtUnlock).not.toHaveBeenCalled();
    expect(typesOf()).not.toContain(types.MULTICHAIN_NEXT_KEYS_DERIVED);
    expect(typesOf()).toContain(types.START_WALLET_REQUESTED);
  });

  test('with the flag turned on during the ceremony: the Hathor Next keys derive from the words, with no root', async () => {
    jest.spyOn(multichainKeys, 'prepareNextKeysAtUnlock').mockResolvedValue(null);

    const { typesOf } = await render({
      toggles: { [MULTICHAIN_FEATURE_TOGGLE]: false },
      during: { [MULTICHAIN_FEATURE_TOGGLE]: true },
    });

    expect(verifyPasskeyForUnlock.mock.calls[0][0].shareRoot).toBe(false);
    expect(rememberPasskeyShieldedKeys).toHaveBeenCalledWith(WORDS, undefined);
    expect(multichainKeys.prepareNextKeysAtUnlock).toHaveBeenCalledTimes(1);
    expect(multichainKeys.prepareNextKeysAtUnlock).toHaveBeenCalledWith(WORDS, true, undefined);
    expect(typesOf()).toContain(types.MULTICHAIN_NEXT_KEYS_DERIVED);
  });

  // Unleash's first answer comes while the sheet is up: until then the flag was the saved one.
  test('with Unleash answering off during the ceremony, over a flag saved on: no Hathor Next keys', async () => {
    STORE.setItem(FEATURE_TOGGLES_LAST_KNOWN_VALUES_KEY, { [MULTICHAIN_FEATURE_TOGGLE]: true });
    jest.spyOn(multichainKeys, 'prepareNextKeysAtUnlock').mockResolvedValue(null);

    const { typesOf } = await render({ during: { [MULTICHAIN_FEATURE_TOGGLE]: false } });

    expect(verifyPasskeyForUnlock.mock.calls[0][0].shareRoot).toBe(true);
    expect(multichainKeys.prepareNextKeysAtUnlock).not.toHaveBeenCalled();
    expect(typesOf()).not.toContain(types.MULTICHAIN_NEXT_KEYS_DERIVED);
  });

  test('starts the wallet when none runs', async () => {
    const { typesOf } = await render();

    expect(typesOf()).toContain(types.START_WALLET_REQUESTED);
    expect(typesOf()).not.toContain(types.SHIELDED_VIEW_UNLOCK_REQUESTED);
    expect(typesOf()).toContain(unlockScreen().type);
  });

  // A running wallet that holds its shielded outputs locked unlocks with the scan key this
  // ceremony derived, as PinScreen unlocks it with the PIN.
  test('asks to unlock the running wallet\'s shielded outputs, with no PIN', async () => {
    const { actions, typesOf } = await render({ wallet: { name: 'running wallet' } });

    expect(actions).toContainEqual(
      shieldedViewUnlockRequested({ source: SHIELDED_UNLOCK_SOURCE.LOCK_SCREEN }),
    );
    expect(actions.find((action) => action.type === types.SHIELDED_VIEW_UNLOCK_REQUESTED)
      .payload.pinCode).toBeUndefined();
    expect(typesOf()).not.toContain(types.START_WALLET_REQUESTED);
    expect(typesOf()).toContain(unlockScreen().type);
  });
});
