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
  setWallet,
  shieldedViewUnlockRequested,
  types,
  unlockScreen,
} from '../../src/actions';
import { SHIELDED_UNLOCK_SOURCE } from '../../src/constants';
import { STORE } from '../../src/store';
import PasskeyLockScreen from '../../src/screens/PasskeyLockScreen';
import { verifyPasskeyForUnlock } from '../../src/passkey/passkeySigner';
import { rememberPasskeyShieldedKeys } from '../../src/passkey/shieldedKeys';
import {
  finishWalletServiceRegistration,
  walletServiceRegistrationForUnlock,
} from '../../src/passkey/walletServiceRegistration';
/* eslint-enable import/first */

const WORDS = 'passkey words';

let mounted = null;

/** Renders the lock screen, which runs the unlock ceremony as it mounts. */
async function render({ wallet = null } = {}) {
  const actions = [];
  const recordActions = () => (next) => (action) => {
    actions.push(action);
    return next(action);
  };
  const store = createStore(reducer, applyMiddleware(recordActions));
  if (wallet) {
    store.dispatch(setWallet(wallet));
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
    verifyPasskeyForUnlock.mockImplementation(async ({ onWords }) => onWords(WORDS));
    walletServiceRegistrationForUnlock.mockReturnValue(undefined);
  });

  afterEach(async () => {
    if (mounted) {
      await act(async () => { mounted.unmount(); });
      mounted = null;
    }
    jest.restoreAllMocks();
    jest.clearAllMocks();
  });

  // The unlock ceremony also derives the shielded keys: no second Face ID.
  test('derives the shielded keys in the unlock ceremony, and still registers the wallet', async () => {
    const registration = { prepared: true };
    const register = jest.fn(() => registration);
    walletServiceRegistrationForUnlock.mockReturnValue(register);

    await render();

    expect(rememberPasskeyShieldedKeys).toHaveBeenCalledWith(WORDS);
    expect(register).toHaveBeenCalledWith(WORDS);
    expect(finishWalletServiceRegistration).toHaveBeenCalledWith(registration);
  });

  test('derives them when the wallet registers nothing too', async () => {
    await render();

    expect(rememberPasskeyShieldedKeys).toHaveBeenCalledWith(WORDS);
    expect(finishWalletServiceRegistration).toHaveBeenCalledWith(undefined);
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
