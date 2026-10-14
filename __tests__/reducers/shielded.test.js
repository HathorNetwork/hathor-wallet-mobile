/**
 * Copyright (c) Hathor Labs and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { describe, test, expect } from '@jest/globals';
import { reducer, SHIELDED_INITIAL_STATE } from '../../src/reducers/reducer';
import {
  reloadWalletRequested,
  resetData,
  resetWalletSuccess,
  shieldedCapabilityUpdate,
  shieldedProviderUpdate,
  shieldedViewUnlockRequested,
  startWalletRequested,
} from '../../src/actions';
import { SHIELDED_PROVIDER_STATUS, SHIELDED_UNLOCK_SOURCE } from '../../src/constants';

const getInitialState = () => reducer(undefined, { type: '@@INIT' });

const CAPABILITY = {
  level: 'watch',
  reason: 'locked',
  cause: 'wrong-pin',
  canReceive: false,
  canSpend: false,
  historyComplete: true,
  undecoded: { txIds: ['tx1'], locked: 1, unreadable: 0, error: 0 },
};

// A wallet whose provider failed its self-test.
const failedState = () => reducer(getInitialState(), shieldedProviderUpdate({
  status: SHIELDED_PROVIDER_STATUS.FAILED,
  error: 'HathorCtCrypto native module not found.',
}));

describe('shielded reducer', () => {
  test('starts with no provider registered and no capability', () => {
    expect(getInitialState().shielded).toEqual(SHIELDED_INITIAL_STATE);
    expect(SHIELDED_INITIAL_STATE.providerStatus).toBe(SHIELDED_PROVIDER_STATUS.UNREGISTERED);
    expect(SHIELDED_INITIAL_STATE.providerError).toBeNull();
    expect(SHIELDED_INITIAL_STATE.capability).toBeNull();
  });

  test('records the provider status', () => {
    const ready = reducer(getInitialState(), shieldedProviderUpdate({
      status: SHIELDED_PROVIDER_STATUS.READY,
    }));
    expect(ready.shielded.providerStatus).toBe(SHIELDED_PROVIDER_STATUS.READY);
    expect(ready.shielded.providerError).toBeNull();

    const failed = failedState();
    expect(failed.shielded.providerStatus).toBe(SHIELDED_PROVIDER_STATUS.FAILED);
    expect(failed.shielded.providerError).toBe('HathorCtCrypto native module not found.');
  });

  test('resets at every start, so a reload or a network change starts over', () => {
    const started = reducer(failedState(), startWalletRequested({ words: 'words', pin: '111111' }));
    expect(started.shielded).toEqual(SHIELDED_INITIAL_STATE);
  });

  test('resets with the wallet and with the data', () => {
    expect(reducer(failedState(), resetWalletSuccess()).shielded).toEqual(SHIELDED_INITIAL_STATE);
    expect(reducer(failedState(), resetData()).shielded).toEqual(SHIELDED_INITIAL_STATE);
  });

  test('keeps the status through a reload request, until the start it dispatches', () => {
    expect(reducer(failedState(), reloadWalletRequested()).shielded)
      .toEqual(failedState().shielded);
  });

  test('records the capability the wallet reports, next to the provider status', () => {
    const ready = reducer(getInitialState(), shieldedProviderUpdate({
      status: SHIELDED_PROVIDER_STATUS.READY,
    }));
    const next = reducer(ready, shieldedCapabilityUpdate(CAPABILITY));
    expect(next.shielded).toEqual({
      ...SHIELDED_INITIAL_STATE,
      providerStatus: SHIELDED_PROVIDER_STATUS.READY,
      providerError: null,
      capability: CAPABILITY,
    });
  });

  test('drops the capability at the next start', () => {
    const withCapability = reducer(getInitialState(), shieldedCapabilityUpdate(CAPABILITY));
    expect(reducer(withCapability, startWalletRequested({ words: 'words', pin: '111111' })).shielded)
      .toEqual(SHIELDED_INITIAL_STATE);
  });

  test('keeps no trace of an unlock request, which carries a PIN', () => {
    const state = reducer(failedState(), shieldedCapabilityUpdate(CAPABILITY));
    const next = reducer(state, shieldedViewUnlockRequested({
      pinCode: '123456',
      source: SHIELDED_UNLOCK_SOURCE.LOCK_SCREEN,
    }));
    expect(next).toBe(state);
  });
});
