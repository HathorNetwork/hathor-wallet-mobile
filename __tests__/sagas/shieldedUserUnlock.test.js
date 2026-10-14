/**
 * Copyright (c) Hathor Labs and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { jest, describe, test, expect, beforeEach, afterEach } from '@jest/globals';

// One shared logger object, so the tests can assert on what the saga logs.
jest.mock('../../src/logger', () => {
  const log = {
    error: jest.fn(), warn: jest.fn(), info: jest.fn(), debug: jest.fn(), log: jest.fn(),
  };
  return { logger: () => log };
});

/* eslint-disable import/first */
import { runSaga, stdChannel } from 'redux-saga';
import { constants as hathorLibConstants, errors } from '@hathor/wallet-lib';
import { saga } from '../../src/sagas/shielded';
import { WALLET_STATUS } from '../../src/sagas/wallet';
import { reducer } from '../../src/reducers/reducer';
import {
  onExceptionCaptured,
  shieldedCapabilityUpdate,
  shieldedReprocessRequested,
  shieldedUnlockStatusUpdate,
  shieldedViewUnlockRequested,
  startWalletSuccess,
  types,
} from '../../src/actions';
import { SHIELDED_PROVIDER_STATUS, SHIELDED_UNLOCK_SOURCE } from '../../src/constants';
import { SHIELDED_RECEIVE_INITIAL_STATE } from '../../src/shielded/receiveState';
import {
  SHIELDED_UNLOCK_INITIAL_STATE,
  SHIELDED_UNLOCK_PROGRESS,
} from '../../src/shielded/unlockState';
import { logger } from '../../src/logger';
/* eslint-enable import/first */

const log = logger();
const HTR = hathorLibConstants.NATIVE_TOKEN_UID;
const PIN = '246810';
const { IDLE, UNLOCKING, DECODING, FAILED } = SHIELDED_UNLOCK_PROGRESS;

const capability = ({ undecoded, ...rest } = {}) => ({
  level: 'full',
  reason: null,
  cause: null,
  canReceive: true,
  canSpend: true,
  historyComplete: true,
  ...rest,
  undecoded: {
    txIds: [], locked: 0, unreadable: 0, error: 0, ...undecoded,
  },
});
const LOCKED = capability({
  level: 'watch',
  reason: 'locked',
  cause: 'wrong-pin',
  canReceive: false,
  canSpend: false,
  undecoded: { txIds: ['tx1', 'tx2'], locked: 2 },
});
const UNLOCKED = capability({ undecoded: { txIds: ['tx1', 'tx2'], locked: 2 } });
const DECODED = capability();
const IN_ERROR = capability({ undecoded: { txIds: ['tx3'], error: 1 } });

const progress = (status, errorCode = null) => shieldedUnlockStatusUpdate({ status, errorCode });

/**
 * Runs the shielded saga over a running wallet with HTR registered and a ready provider. The
 * shielded slice changes as the reducer changes it. The wallet's walk ends when a test calls
 * finishWalk().
 */
function setup({ start = LOCKED } = {}) {
  let finishWalk;
  const reprocessed = new Promise((resolve) => { finishWalk = resolve; });
  const wallet = {
    isReady: jest.fn(() => true),
    getShieldedCapability: jest.fn(async () => state.shielded.capability),
    unlockShieldedView: jest.fn(async () => ({ capability: UNLOCKED, reprocessed })),
    reprocessShieldedOutputs: jest.fn(() => reprocessed),
  };
  let state = {
    wallet,
    walletStartState: WALLET_STATUS.READY,
    tokens: { [HTR]: { uid: HTR } },
    shielded: {
      providerStatus: SHIELDED_PROVIDER_STATUS.READY,
      providerError: null,
      capability: start,
      receive: SHIELDED_RECEIVE_INITIAL_STATE,
      unlock: SHIELDED_UNLOCK_INITIAL_STATE,
    },
  };
  const reduceShielded = (action) => {
    if (action.type.startsWith('SHIELDED_')) {
      state = reducer(state, action);
    }
  };
  const channel = stdChannel();
  const dispatched = [];
  runSaga(
    {
      channel,
      dispatch: (action) => {
        dispatched.push(action);
        reduceShielded(action);
      },
      getState: () => state,
    },
    saga,
  );
  const deliver = (action) => {
    reduceShielded(action);
    channel.put(action);
  };
  const progressUpdates = () => dispatched.filter(
    (action) => action.type === types.SHIELDED_UNLOCK_STATUS_UPDATE,
  );
  const refreshes = () => dispatched.filter(
    (action) => action.type === types.WALLET_REFRESH_SHARED_ADDRESS,
  ).length;
  // The start loaded the balances with the start capability.
  deliver(startWalletSuccess());
  return {
    wallet,
    deliver,
    dispatched,
    progressUpdates,
    refreshes,
    finishWalk,
    getState: () => state,
    setState: (next) => { state = { ...state, ...next }; },
  };
}

const userUnlock = () => shieldedViewUnlockRequested({
  pinCode: PIN,
  source: SHIELDED_UNLOCK_SOURCE.USER,
});
const lockScreenUnlock = () => shieldedViewUnlockRequested({
  pinCode: PIN,
  source: SHIELDED_UNLOCK_SOURCE.LOCK_SCREEN,
});

const wait = (ms) => jest.advanceTimersByTimeAsync(ms);

describe('the unlock the user asks for', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  test('reports its progress until the walk ends and the balances are refreshed', async () => {
    const context = setup();
    const { wallet, deliver, dispatched, progressUpdates } = context;

    deliver(userUnlock());
    await wait(0);

    expect(wallet.unlockShieldedView).toHaveBeenCalledWith({ pinCode: PIN });
    expect(dispatched.filter((action) => action.type !== types.SHIELDED_UNLOCK_STATUS_UPDATE))
      .toEqual([shieldedCapabilityUpdate(UNLOCKED)]);
    expect(progressUpdates()).toEqual([progress(UNLOCKING), progress(DECODING)]);
    expect(context.getState().shielded.unlock.status).toBe(DECODING);

    context.finishWalk(DECODED);
    await wait(0);

    expect(context.refreshes()).toBe(1);
    expect(progressUpdates()).toEqual([progress(UNLOCKING), progress(DECODING), progress(IDLE)]);
    expect(context.getState().shielded.unlock).toEqual(SHIELDED_UNLOCK_INITIAL_STATE);
    expect(JSON.stringify(dispatched)).not.toContain(PIN);
  });

  test('reports a refusal with its code, with no error modal and no PIN in the log', async () => {
    const { wallet, deliver, dispatched, getState } = setup();
    wallet.unlockShieldedView.mockRejectedValue(
      new errors.ShieldedKeyError('shielded-wrong-pin', 'The PIN does not decrypt the key.'),
    );

    deliver(userUnlock());
    await wait(0);

    expect(getState().shielded.unlock).toEqual({ status: FAILED, errorCode: 'shielded-wrong-pin' });
    expect(dispatched.map((action) => action.type)).not.toContain(types.EXCEPTION_CAPTURED);
    expect(log.error).toHaveBeenCalledTimes(1);
    expect(JSON.stringify(log.error.mock.calls)).not.toContain(PIN);
  });

  test('sends an error nothing expects to the error modal', async () => {
    const { wallet, deliver, dispatched, getState } = setup();
    const error = new Error('store read failed');
    wallet.getShieldedCapability.mockRejectedValueOnce(error);

    deliver(userUnlock());
    await wait(0);

    expect(getState().shielded.unlock).toEqual({ status: FAILED, errorCode: null });
    expect(dispatched).toContainEqual(onExceptionCaptured(error, false));
  });

  test('goes back to idle when the wallet is not locked anymore', async () => {
    const { wallet, deliver, progressUpdates } = setup({ start: DECODED });

    deliver(userUnlock());
    await wait(0);

    expect(wallet.unlockShieldedView).not.toHaveBeenCalled();
    expect(progressUpdates()).toEqual([progress(UNLOCKING), progress(IDLE)]);
  });

  test('goes back to idle when a PIN entry at the lock screen replaces it', async () => {
    const { wallet, deliver, progressUpdates, getState } = setup();
    wallet.unlockShieldedView
      .mockImplementationOnce(() => new Promise(() => {}))
      .mockImplementationOnce(async () => ({
        capability: UNLOCKED,
        reprocessed: new Promise(() => {}),
      }));

    deliver(userUnlock());
    await wait(0);
    deliver(lockScreenUnlock());
    await wait(0);

    expect(wallet.unlockShieldedView).toHaveBeenCalledTimes(2);
    expect(progressUpdates()).toEqual([progress(UNLOCKING), progress(IDLE)]);
    expect(getState().shielded.capability).toEqual(UNLOCKED);
  });

  test('leaves the progress of the next wallet alone', async () => {
    const { deliver, progressUpdates, finishWalk, setState } = setup();

    deliver(userUnlock());
    await wait(0);
    setState({ wallet: { isReady: () => true } });
    finishWalk(DECODED);
    await wait(0);

    expect(progressUpdates()).toEqual([progress(UNLOCKING), progress(DECODING)]);
  });

  test('reports nothing for the unlock at the lock screen', async () => {
    const { wallet, deliver, progressUpdates, finishWalk } = setup();

    deliver(lockScreenUnlock());
    await wait(0);
    finishWalk(DECODED);
    await wait(0);

    expect(wallet.unlockShieldedView).toHaveBeenCalledTimes(1);
    expect(progressUpdates()).toEqual([]);
  });
});

describe('the retry of private funds that could not be read', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  test('processes the history again, then refreshes the balances', async () => {
    const { wallet, deliver, progressUpdates, refreshes, finishWalk } = setup({ start: IN_ERROR });

    deliver(shieldedReprocessRequested());
    await wait(0);

    expect(wallet.reprocessShieldedOutputs).toHaveBeenCalledTimes(1);
    expect(progressUpdates()).toEqual([progress(DECODING)]);
    expect(refreshes()).toBe(0);

    finishWalk(DECODED);
    await wait(0);

    expect(refreshes()).toBe(1);
    expect(progressUpdates()).toEqual([progress(DECODING), progress(IDLE)]);
  });

  test.each([
    ['connecting', 'shielded-not-ready'],
    ['stopped', 'shielded-not-started'],
  ])('only logs the refusal of a wallet that is %s', async (_label, errorCode) => {
    const { wallet, deliver, dispatched, progressUpdates, refreshes } = setup({ start: IN_ERROR });
    wallet.reprocessShieldedOutputs.mockRejectedValue(
      new errors.ShieldedKeyError(errorCode, 'The wallet cannot process its history now.'),
    );

    deliver(shieldedReprocessRequested());
    await wait(0);

    expect(log.error).toHaveBeenCalledTimes(1);
    expect(JSON.stringify(log.error.mock.calls)).toContain(errorCode);
    expect(dispatched.map((action) => action.type)).not.toContain(types.EXCEPTION_CAPTURED);
    expect(refreshes()).toBe(0);
    expect(progressUpdates()).toEqual([progress(DECODING), progress(IDLE)]);
  });

  test('sends an error nothing expects to the error modal', async () => {
    const { wallet, deliver, dispatched, progressUpdates } = setup({ start: IN_ERROR });
    const error = new Error('store read failed');
    wallet.reprocessShieldedOutputs.mockRejectedValue(error);

    deliver(shieldedReprocessRequested());
    await wait(0);

    expect(dispatched).toContainEqual(onExceptionCaptured(error, false));
    expect(progressUpdates()).toEqual([progress(DECODING), progress(IDLE)]);
  });

  test.each([
    ['no wallet runs', { wallet: null }],
    ['the provider failed its self-test', {
      shielded: {
        providerStatus: SHIELDED_PROVIDER_STATUS.FAILED,
        providerError: 'native module missing',
        capability: IN_ERROR,
        receive: SHIELDED_RECEIVE_INITIAL_STATE,
        unlock: SHIELDED_UNLOCK_INITIAL_STATE,
      },
    }],
  ])('does nothing when %s', async (_label, change) => {
    const { wallet, deliver, dispatched, setState } = setup({ start: IN_ERROR });
    dispatched.length = 0;
    setState(change);

    deliver(shieldedReprocessRequested());
    await wait(0);

    expect(wallet.reprocessShieldedOutputs).not.toHaveBeenCalled();
    expect(dispatched).toEqual([]);
  });
  test('does nothing for a wallet that cannot process its history again, as on the wallet-service facade', async () => {
    const { wallet, deliver, dispatched } = setup({ start: IN_ERROR });
    dispatched.length = 0;
    delete wallet.reprocessShieldedOutputs;

    deliver(shieldedReprocessRequested());
    await wait(0);

    expect(dispatched).toEqual([]);
    expect(log.error).not.toHaveBeenCalled();
  });
});
