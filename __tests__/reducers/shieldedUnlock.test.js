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
  shieldedReprocessRequested,
  shieldedUnlockStatusUpdate,
  shieldedViewUnlockRequested,
  startWalletRequested,
} from '../../src/actions';
import { SHIELDED_UNLOCK_SOURCE } from '../../src/constants';
import {
  SHIELDED_UNLOCK_INITIAL_STATE,
  SHIELDED_UNLOCK_PROGRESS,
} from '../../src/shielded/unlockState';

const getInitialState = () => reducer(undefined, { type: '@@INIT' });

const failed = () => reducer(getInitialState(), shieldedUnlockStatusUpdate({
  status: SHIELDED_UNLOCK_PROGRESS.FAILED,
  errorCode: 'shielded-wrong-pin',
}));

describe('the progress of an unlock or a retry', () => {
  test('starts idle', () => {
    expect(getInitialState().shielded.unlock).toEqual(SHIELDED_UNLOCK_INITIAL_STATE);
    expect(SHIELDED_UNLOCK_INITIAL_STATE).toEqual({
      status: SHIELDED_UNLOCK_PROGRESS.IDLE,
      errorCode: null,
    });
  });

  test('records the progress, and the code of a refusal', () => {
    const decoding = reducer(getInitialState(), shieldedUnlockStatusUpdate({
      status: SHIELDED_UNLOCK_PROGRESS.DECODING,
    }));
    expect(decoding.shielded.unlock).toEqual({
      status: SHIELDED_UNLOCK_PROGRESS.DECODING,
      errorCode: null,
    });
    expect(failed().shielded.unlock).toEqual({
      status: SHIELDED_UNLOCK_PROGRESS.FAILED,
      errorCode: 'shielded-wrong-pin',
    });
  });

  test('keeps the rest of the shielded state', () => {
    const state = failed();
    const next = reducer(state, shieldedUnlockStatusUpdate({
      status: SHIELDED_UNLOCK_PROGRESS.UNLOCKING,
    }));
    expect(next.shielded).toEqual({
      ...state.shielded,
      unlock: { status: SHIELDED_UNLOCK_PROGRESS.UNLOCKING, errorCode: null },
    });
  });

  test('resets at every start, with the wallet and with the data', () => {
    expect(reducer(failed(), startWalletRequested({ words: 'words', pin: '111111' })).shielded.unlock)
      .toEqual(SHIELDED_UNLOCK_INITIAL_STATE);
    expect(reducer(failed(), resetWalletSuccess()).shielded.unlock)
      .toEqual(SHIELDED_UNLOCK_INITIAL_STATE);
    expect(reducer(failed(), resetData()).shielded.unlock)
      .toEqual(SHIELDED_UNLOCK_INITIAL_STATE);
  });

  test('keeps no trace of the requests, the user\'s unlock with its PIN included', () => {
    const state = failed();
    expect(reducer(state, shieldedViewUnlockRequested({
      pinCode: '123456',
      source: SHIELDED_UNLOCK_SOURCE.USER,
    }))).toBe(state);
    expect(reducer(state, shieldedReprocessRequested())).toBe(state);
  });
});
