/**
 * Copyright (c) Hathor Labs and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { describe, test, expect } from '@jest/globals';
import { reducer } from '../../src/reducers/reducer';
import {
  resetData,
  resetWalletSuccess,
  shieldedCapabilityUpdate,
  shieldedReceiveAddressUpdate,
  startWalletRequested,
} from '../../src/actions';
import {
  SHIELDED_RECEIVE_INITIAL_STATE,
  SHIELDED_RECEIVE_STATUS,
} from '../../src/shielded/receiveState';

const getInitialState = () => reducer(undefined, { type: '@@INIT' });

const READY_RECEIVE = {
  status: SHIELDED_RECEIVE_STATUS.READY,
  address: 'SHIELDED_ADDRESS_0',
  index: 0,
  reason: null,
};

const withReceive = () => reducer(getInitialState(), shieldedReceiveAddressUpdate(READY_RECEIVE));

describe('the private receive state', () => {
  test('starts idle', () => {
    expect(getInitialState().shielded.receive).toEqual(SHIELDED_RECEIVE_INITIAL_STATE);
  });

  test('records the address, or where it stands', () => {
    expect(withReceive().shielded.receive).toEqual(READY_RECEIVE);

    const locked = reducer(withReceive(), shieldedReceiveAddressUpdate({
      status: SHIELDED_RECEIVE_STATUS.LOCKED,
      reason: 'wrong-pin',
    }));
    expect(locked.shielded.receive).toEqual({
      status: SHIELDED_RECEIVE_STATUS.LOCKED,
      address: null,
      index: null,
      reason: 'wrong-pin',
    });
  });

  test('keeps the rest of the shielded state', () => {
    const capability = { level: 'full' };
    const state = reducer(getInitialState(), shieldedCapabilityUpdate(capability));
    const next = reducer(state, shieldedReceiveAddressUpdate(READY_RECEIVE));
    expect(next.shielded).toEqual({ ...state.shielded, receive: READY_RECEIVE });
  });

  test('resets at every start, with the wallet and with the data', () => {
    expect(reducer(withReceive(), startWalletRequested({ words: 'words', pin: '111111' })).shielded.receive)
      .toEqual(SHIELDED_RECEIVE_INITIAL_STATE);
    expect(reducer(withReceive(), resetWalletSuccess()).shielded.receive)
      .toEqual(SHIELDED_RECEIVE_INITIAL_STATE);
    expect(reducer(withReceive(), resetData()).shielded.receive)
      .toEqual(SHIELDED_RECEIVE_INITIAL_STATE);
  });
});
