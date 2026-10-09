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
import { constants as hathorLibConstants } from '@hathor/wallet-lib';
import {
  CAPABILITY_REFRESH_DELAY_MS,
  isBalanceRelevantChange,
  refreshShieldedBalances,
  saga,
} from '../../src/sagas/shielded';
import { WALLET_STATUS } from '../../src/sagas/wallet';
import {
  shieldedCapabilityUpdate,
  startWalletSuccess,
  tokenFetchBalanceRequested,
  tokenFetchHistoryRequested,
  tokenInvalidateHistory,
  types,
  walletRefreshSharedAddress,
} from '../../src/actions';
import { SHIELDED_PROVIDER_STATUS } from '../../src/constants';
import { logger } from '../../src/logger';
/* eslint-enable import/first */

const log = logger();
const HTR = hathorLibConstants.NATIVE_TOKEN_UID;
const TOKEN = '00000000aaaabbbbccccddddeeeeffff00001111222233334444555566667777';

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

const REFRESH = [
  tokenFetchBalanceRequested(HTR, true),
  tokenFetchHistoryRequested(HTR, true),
  tokenFetchBalanceRequested(TOKEN, true),
  tokenInvalidateHistory(TOKEN),
  walletRefreshSharedAddress(),
];

/**
 * Runs the shielded saga over a state that holds a running wallet with HTR and one custom token
 * registered. deliver() updates the state as the reducer does, then hands the action to the saga.
 */
function setup({ startCapability = LOCKED } = {}) {
  const wallet = { isReady: jest.fn(() => true) };
  const state = {
    wallet,
    walletStartState: WALLET_STATUS.READY,
    tokens: { [HTR]: { uid: HTR }, [TOKEN]: { uid: TOKEN } },
    shielded: {
      providerStatus: SHIELDED_PROVIDER_STATUS.READY,
      providerError: null,
      capability: startCapability,
    },
  };
  const channel = stdChannel();
  const dispatched = [];
  const task = runSaga(
    { channel, dispatch: (action) => dispatched.push(action), getState: () => state },
    saga,
  );
  const deliver = (action) => {
    if (action.type === types.SHIELDED_CAPABILITY_UPDATE) {
      state.shielded = { ...state.shielded, capability: action.payload };
    }
    channel.put(action);
  };
  const refreshes = () => dispatched.filter(
    (action) => action.type === types.WALLET_REFRESH_SHARED_ADDRESS,
  ).length;
  // The start loaded the balances with the start capability.
  deliver(startWalletSuccess());
  return { state, wallet, deliver, dispatched, refreshes, task };
}

const wait = (ms) => jest.advanceTimersByTimeAsync(ms);

describe('isBalanceRelevantChange', () => {
  test.each([
    ['no previous refresh', null, capability()],
    ['the level changes', LOCKED, capability({ ...LOCKED, level: 'full' })],
    ['the cause changes', LOCKED, { ...LOCKED, cause: 'error' }],
    ['the history completes', capability({ historyComplete: false }), capability()],
    ['the history stops being complete', capability(), capability({ historyComplete: false })],
    ['locked outputs go down', LOCKED, capability({ ...LOCKED, undecoded: { locked: 1 } })],
    ['outputs in error go down', capability({ undecoded: { error: 2 } }), capability({ undecoded: { error: 1 } })],
  ])('is true when %s', (_label, previous, next) => {
    expect(isBalanceRelevantChange(previous, next)).toBe(true);
  });

  test.each([
    ['nothing changes', capability(), capability()],
    ['locked outputs go up', LOCKED, capability({ ...LOCKED, undecoded: { locked: 3 } })],
    ['outputs in error go up', capability(), capability({ undecoded: { error: 1 } })],
    ['unreadable outputs change', capability(), capability({ undecoded: { unreadable: 4 } })],
    ['only the tx list changes', capability(), capability({ undecoded: { txIds: ['tx9'] } })],
    ['only canReceive changes', capability(), capability({ canReceive: false })],
    ['there is no capability', capability(), null],
  ])('is false when %s', (_label, previous, next) => {
    expect(isBalanceRelevantChange(previous, next)).toBe(false);
  });
});

describe('refreshShieldedBalances', () => {
  async function refresh(state, wallet) {
    const dispatched = [];
    const result = await runSaga(
      { dispatch: (action) => dispatched.push(action), getState: () => state },
      refreshShieldedBalances,
      wallet,
    ).toPromise();
    return { result, dispatched };
  }

  const readyState = (wallet) => ({
    wallet,
    walletStartState: WALLET_STATUS.READY,
    tokens: { [HTR]: { uid: HTR }, [TOKEN]: { uid: TOKEN } },
  });

  test('fetches every registered balance again, and the history of HTR', async () => {
    const wallet = { isReady: () => true };
    expect(await refresh(readyState(wallet), wallet))
      .toEqual({ result: true, dispatched: REFRESH });
  });

  test.each([
    ['the wallet is not ready', { isReady: () => false }, (state) => state],
    ['the wallet is still loading', { isReady: () => true }, (state) => ({
      ...state, walletStartState: WALLET_STATUS.LOADING,
    })],
    ['another wallet runs', { isReady: () => true }, (state) => ({
      ...state, wallet: { isReady: () => true },
    })],
  ])('does nothing when %s', async (_label, wallet, change) => {
    expect(await refresh(change(readyState(wallet)), wallet))
      .toEqual({ result: false, dispatched: [] });
  });
});

describe('the refresh on a shielded capability change', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  test('refreshes the balances once the change settles', async () => {
    const { deliver, dispatched, refreshes } = setup();

    deliver(shieldedCapabilityUpdate(capability()));
    await wait(CAPABILITY_REFRESH_DELAY_MS - 1);
    expect(refreshes()).toBe(0);
    await wait(1);

    expect(CAPABILITY_REFRESH_DELAY_MS).toBe(300);
    expect(dispatched).toEqual(REFRESH);
  });

  test('refreshes once for a burst of changes', async () => {
    const { deliver, refreshes } = setup();

    deliver(shieldedCapabilityUpdate(capability({ ...LOCKED, cause: 'error' })));
    await wait(100);
    deliver(shieldedCapabilityUpdate(capability({ undecoded: { locked: 1 } })));
    await wait(100);
    deliver(shieldedCapabilityUpdate(capability()));
    await wait(299);
    expect(refreshes()).toBe(0);
    await wait(1);

    expect(refreshes()).toBe(1);
  });

  test('ignores a change that leaves the balances as they are', async () => {
    const { deliver, refreshes } = setup();

    deliver(shieldedCapabilityUpdate({ ...LOCKED, undecoded: { ...LOCKED.undecoded, locked: 3 } }));
    await wait(300);

    expect(refreshes()).toBe(0);
  });

  test('compares with the capability of the last refresh, not of the last change', async () => {
    const { deliver, refreshes } = setup();
    const locked = (count) => ({ ...LOCKED, undecoded: { ...LOCKED.undecoded, locked: count } });

    // More locked outputs, then back to the count the balances were loaded with: no output was
    // decoded since then.
    deliver(shieldedCapabilityUpdate(locked(3)));
    await wait(300);
    deliver(shieldedCapabilityUpdate(locked(2)));
    await wait(300);
    expect(refreshes()).toBe(0);

    deliver(shieldedCapabilityUpdate(locked(1)));
    await wait(300);
    expect(refreshes()).toBe(1);
    deliver(shieldedCapabilityUpdate(locked(1)));
    await wait(300);
    expect(refreshes()).toBe(1);
  });

  test('takes the end of a start or a reload as a refresh', async () => {
    const { deliver, refreshes } = setup({ startCapability: capability() });

    deliver(shieldedCapabilityUpdate(capability()));
    await wait(300);

    expect(refreshes()).toBe(0);
  });

  test('waits for the wallet to be ready, then refreshes at the next change', async () => {
    const { state, wallet, deliver, refreshes } = setup();

    wallet.isReady.mockReturnValue(false);
    deliver(shieldedCapabilityUpdate(capability({ ...LOCKED, level: 'full' })));
    await wait(300);
    state.walletStartState = WALLET_STATUS.LOADING;
    wallet.isReady.mockReturnValue(true);
    deliver(shieldedCapabilityUpdate(capability({ ...LOCKED, level: 'full', cause: null })));
    await wait(300);
    expect(refreshes()).toBe(0);

    state.walletStartState = WALLET_STATUS.READY;
    deliver(shieldedCapabilityUpdate(capability()));
    await wait(300);
    expect(refreshes()).toBe(1);
  });

  test('logs a failure and keeps handling changes', async () => {
    const { wallet, deliver, refreshes } = setup();

    wallet.isReady.mockImplementationOnce(() => { throw new Error('storage closed'); });
    deliver(shieldedCapabilityUpdate(capability({ ...LOCKED, cause: 'error' })));
    await wait(300);
    expect(log.error).toHaveBeenCalledTimes(1);
    expect(refreshes()).toBe(0);

    deliver(shieldedCapabilityUpdate(capability()));
    await wait(300);
    expect(refreshes()).toBe(1);
  });
});
