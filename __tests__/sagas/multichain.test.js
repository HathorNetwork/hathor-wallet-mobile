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

jest.mock('../../src/passkey/passkeySigner', () => ({
  ...jest.requireActual('../../src/passkey/passkeySigner'),
  withPasskeyWords: jest.fn(),
}));

/* eslint-disable import/first */
import { runSaga, stdChannel } from 'redux-saga';
import { reducer } from '../../src/reducers/reducer';
import {
  multichainConnectSettingChanged,
  multichainLoadRequested,
  multichainMockScenarioSet,
  multichainNextHistoryRequested,
  multichainNextKeysUnlockRequested,
  multichainNextSendRequested,
  multichainTransferRequested,
  networkChanged,
  resetWallet,
  setFeatureToggles,
  setFullNodeNetworkName,
  setServerInfo,
  startWalletSuccess,
  types,
} from '../../src/actions';
import { MULTICHAIN_FEATURE_TOGGLE, multichainKeyMap } from '../../src/constants';
import { STORE } from '../../src/store';
import { saga } from '../../src/sagas/multichain';
import { getNextClient, setNextClient } from '../../src/multichain/nextClient';
import { deriveMockNextAddress } from '../../src/multichain/mock/mockNextClient';
import { loadLedger, resetLedger } from '../../src/multichain/mock/mockLedger';
import { MOCK_SCENARIO } from '../../src/multichain/mock/scenarios';
import {
  CONNECT_STATUS,
  NEXT_STATUS,
  OPERATION_STATUS,
  TRANSFER_STATUS,
} from '../../src/multichain/state';
import { PasskeyCancelledError, withPasskeyWords } from '../../src/passkey/passkeySigner';
/* eslint-enable import/first */

const NETWORK = 'testnet-juliet';
const WORDS = 'abandon ability able';
const PIN = '123456';
const ADDRESS = deriveMockNextAddress(WORDS);
const HTR = '00';

let task = null;

function setup({ flag = true, scenario = MOCK_SCENARIO.FUNDED, start = true } = {}) {
  resetLedger(NETWORK, scenario);
  let state = reducer(undefined, { type: '@@INIT' });
  const channel = stdChannel();
  const dispatched = [];
  const dispatch = (action) => {
    state = reducer(state, action);
    dispatched.push(action);
    channel.put(action);
  };
  task = runSaga({ channel, dispatch, getState: () => state }, saga);
  dispatch(setFeatureToggles({ [MULTICHAIN_FEATURE_TOGGLE]: flag }));
  dispatch(setServerInfo({ decimal_places: 2 }));
  dispatch(setFullNodeNetworkName(NETWORK));
  if (start) {
    dispatch(startWalletSuccess());
  }
  return { getState: () => state, dispatch, dispatched };
}

// Advances the clock, then lets the saga finish what the last timer started.
const wait = async (ms) => {
  await jest.advanceTimersByTimeAsync(ms);
  await jest.advanceTimersByTimeAsync(0);
  await jest.advanceTimersByTimeAsync(0);
};

// Turns "Connect to side chain" on with the PIN, and waits for Hathor Next to load.
async function connect(env) {
  env.dispatch(multichainConnectSettingChanged(true, { pinCode: PIN }));
  await wait(2000);
}

beforeEach(() => {
  jest.useFakeTimers();
  jest.clearAllMocks();
  setNextClient(null);
  STORE.removeItem(multichainKeyMap.next);
  STORE.removeItem(multichainKeyMap.connectedNetworks);
  // A reset of the simulated ledger keeps its transfers: each test starts with none.
  STORE.removeItem(multichainKeyMap.mock(NETWORK));
  jest.spyOn(STORE, 'getWalletWords').mockResolvedValue(WORDS);
  jest.spyOn(STORE, 'isPasskeyWallet').mockReturnValue(false);
});

afterEach(() => {
  task?.cancel();
  getNextClient()?.disconnect();
  jest.useRealTimers();
  jest.restoreAllMocks();
});

describe('turning "Connect to side chain" on', () => {
  test('derives the keys with the PIN, registers from the beginning, loads, then saves', async () => {
    const env = setup();
    const connectSpy = jest.fn();
    env.dispatch(multichainConnectSettingChanged(true, { pinCode: PIN }));
    getNextClient().connect = ((original) => (params) => {
      connectSpy(params);
      return original(params);
    })(getNextClient().connect);
    // Not saved until it loaded.
    expect(env.getState().multichain.connectedNetworks).toEqual({});
    expect(env.getState().multichain.connect.status).toBe(CONNECT_STATUS.CONNECTING);
    await wait(2000);
    const { multichain } = env.getState();
    expect(STORE.getWalletWords).toHaveBeenCalledWith(PIN);
    expect(multichain.connectedNetworks).toEqual({ [NETWORK]: true });
    expect(STORE.getItem(multichainKeyMap.connectedNetworks)).toEqual({ [NETWORK]: true });
    expect(multichain.connect.status).toBe(CONNECT_STATUS.IDLE);
    expect(multichain.next).toMatchObject({
      status: NEXT_STATUS.READY, keysReady: true, address: ADDRESS,
    });
    expect(multichain.next.balances[HTR].data.available).toBe(2500000000n);
    expect(STORE.getItem(multichainKeyMap.next)).toEqual({
      address: ADDRESS,
      registered: { [NETWORK]: true },
    });
  });

  test('stays off, with the reason, when Hathor Next fails to connect', async () => {
    const env = setup({ scenario: MOCK_SCENARIO.CONNECT_FAILS });
    await connect(env);
    const { multichain } = env.getState();
    expect(multichain.connectedNetworks).toEqual({});
    expect(multichain.connect).toEqual({
      status: CONNECT_STATUS.FAILED,
      error: "Couldn't connect to Hathor Next.",
    });
    expect(multichain.next.status).toBe(NEXT_STATUS.STOPPED);
  });

  test("runs a passkey wallet's ceremony, and stays off quietly when it is dismissed", async () => {
    STORE.isPasskeyWallet.mockReturnValue(true);
    withPasskeyWords.mockRejectedValue(new PasskeyCancelledError());
    const env = setup();
    env.dispatch(multichainConnectSettingChanged(true));
    await wait(2000);
    expect(withPasskeyWords).toHaveBeenCalledTimes(1);
    expect(env.getState().multichain.connectedNetworks).toEqual({});
    expect(env.getState().multichain.connect).toEqual({
      status: CONNECT_STATUS.IDLE, error: null,
    });
  });

  test('connects a passkey wallet with the keys its ceremony derives', async () => {
    STORE.isPasskeyWallet.mockReturnValue(true);
    withPasskeyWords.mockImplementation(async (fn) => fn(WORDS));
    const env = setup();
    env.dispatch(multichainConnectSettingChanged(true));
    await wait(2000);
    expect(env.getState().multichain.next).toMatchObject({
      status: NEXT_STATUS.READY, address: ADDRESS,
    });
  });
});

describe('loading Hathor Next when the wallet starts', () => {
  test('uses the keys the unlock derived, with no prompt', async () => {
    STORE.setItem(multichainKeyMap.next, { address: ADDRESS, registered: { [NETWORK]: true } });
    STORE.setItem(multichainKeyMap.connectedNetworks, { [NETWORK]: true });
    const env = setup({ start: false });
    env.dispatch(multichainNextKeysUnlockRequested({ pinCode: PIN }));
    await wait(10);
    env.dispatch(startWalletSuccess());
    expect(env.getState().multichain.next.status).toBe(NEXT_STATUS.CONNECTING);
    await wait(2000);
    expect(env.getState().multichain.next.status).toBe(NEXT_STATUS.READY);
  });

  test('fails without the keys, and loads once the PIN derives them', async () => {
    STORE.setItem(multichainKeyMap.next, { address: ADDRESS, registered: { [NETWORK]: true } });
    STORE.setItem(multichainKeyMap.connectedNetworks, { [NETWORK]: true });
    const env = setup();
    await wait(10);
    expect(env.getState().multichain.next).toMatchObject({
      status: NEXT_STATUS.FAILED,
      error: "Couldn't connect to Hathor Next.",
    });
    env.dispatch(multichainNextKeysUnlockRequested({ pinCode: PIN }));
    await wait(2000);
    expect(env.getState().multichain.next.status).toBe(NEXT_STATUS.READY);
  });

  test('tries again from the loading screen', async () => {
    const env = setup();
    await connect(env);
    env.dispatch(multichainMockScenarioSet(MOCK_SCENARIO.CONNECT_FAILS));
    await wait(10);
    env.dispatch(networkChanged());
    await wait(10);
    env.dispatch(startWalletSuccess());
    await wait(2000);
    expect(env.getState().multichain.next.status).toBe(NEXT_STATUS.FAILED);
    env.dispatch(multichainMockScenarioSet(MOCK_SCENARIO.FUNDED));
    env.dispatch(multichainLoadRequested());
    await wait(2000);
    expect(env.getState().multichain.next.status).toBe(NEXT_STATUS.READY);
  });

  test('waits for the flag: it loads when the flag comes back on', async () => {
    STORE.setItem(multichainKeyMap.next, { address: ADDRESS, registered: { [NETWORK]: true } });
    STORE.setItem(multichainKeyMap.connectedNetworks, { [NETWORK]: true });
    const env = setup({ flag: false, start: false });
    env.dispatch(multichainNextKeysUnlockRequested({ pinCode: PIN }));
    env.dispatch(startWalletSuccess());
    await wait(2000);
    expect(env.getState().multichain.next.status).toBe(NEXT_STATUS.STOPPED);
    env.dispatch(setFeatureToggles({ [MULTICHAIN_FEATURE_TOGGLE]: true }));
    env.dispatch({ type: types.FEATURE_TOGGLE_UPDATED });
    await wait(2000);
    expect(env.getState().multichain.next.status).toBe(NEXT_STATUS.READY);
  });
});

describe('the keys at unlock', () => {
  test("are derived with the lock screen's PIN when the wallet used Hathor Next before", async () => {
    STORE.setItem(multichainKeyMap.next, { address: ADDRESS, registered: { [NETWORK]: true } });
    const env = setup();
    env.dispatch(multichainNextKeysUnlockRequested({ pinCode: PIN }));
    await wait(10);
    expect(getNextClient().hasKeys()).toBe(true);
    expect(env.getState().multichain.next.keysReady).toBe(true);
  });

  test('are left alone when it never did, and the PIN is never stored', async () => {
    const env = setup();
    env.dispatch(multichainNextKeysUnlockRequested({ pinCode: PIN }));
    await wait(10);
    expect(STORE.getWalletWords).not.toHaveBeenCalled();
    const serialized = JSON.stringify(
      env.getState().multichain,
      (_key, value) => (typeof value === 'bigint' ? value.toString() : value),
    );
    expect(serialized).not.toContain(PIN);
  });
});

describe('the ways out of Hathor Next', () => {
  test.each([
    ['the setting turns off', () => multichainConnectSettingChanged(false)],
    ['the network changes', () => networkChanged()],
  ])('stop it when %s, keeping the keys', async (_label, action) => {
    const env = setup();
    await connect(env);
    env.dispatch(action());
    await wait(10);
    expect(env.getState().multichain.next).toMatchObject({
      status: NEXT_STATUS.STOPPED,
      keysReady: true,
      address: ADDRESS,
      balances: {},
    });
    expect(env.getState().multichain.transfers).toEqual([]);
  });

  test('stop it when the flag turns off', async () => {
    const env = setup();
    await connect(env);
    env.dispatch(setFeatureToggles({ [MULTICHAIN_FEATURE_TOGGLE]: false }));
    env.dispatch({ type: types.FEATURE_TOGGLE_UPDATED });
    await wait(10);
    expect(env.getState().multichain.next.status).toBe(NEXT_STATUS.STOPPED);
  });

  test('cancel a connect still running, so it never comes back', async () => {
    const env = setup({ scenario: MOCK_SCENARIO.FUNDED });
    env.dispatch(multichainConnectSettingChanged(true, { pinCode: PIN }));
    await wait(100);
    env.dispatch(networkChanged());
    await wait(3000);
    expect(env.getState().multichain.next.status).toBe(NEXT_STATUS.STOPPED);
    expect(env.getState().multichain.connectedNetworks).toEqual({});
    expect(env.getState().multichain.connect.status).toBe(CONNECT_STATUS.IDLE);
    expect(getNextClient().getNetwork()).toBeNull();
  });

  test('drop a history read that answers after them', async () => {
    const env = setup();
    await connect(env);
    jest.spyOn(getNextClient(), 'getHistory').mockImplementation(() => new Promise((resolve) => {
      setTimeout(() => resolve({ rows: [{ id: 'late' }], cursor: null }), 500);
    }));
    env.dispatch(multichainNextHistoryRequested({ tokenId: HTR }));
    await wait(10);
    env.dispatch(multichainConnectSettingChanged(false));
    await wait(1000);
    expect(env.getState().multichain.next.history).toEqual({});
  });

  test('forget the keys on a wallet reset', async () => {
    const env = setup();
    await connect(env);
    env.dispatch(resetWallet());
    await wait(10);
    expect(getNextClient()).toBeNull();
    expect(env.getState().multichain.connectedNetworks).toEqual({});
    expect(env.getState().multichain.next).toMatchObject({ keysReady: false, address: null });
  });
});

describe('a Hathor Next payment', () => {
  const draft = (draftId) => multichainNextSendRequested({
    tokenId: HTR,
    to: deriveMockNextAddress('someone'),
    amount: 100000000n,
    draftId,
    pinCode: PIN,
  });

  test('settles, and the balance follows', async () => {
    const env = setup();
    await connect(env);
    env.dispatch(draft('draft-1'));
    await wait(1000);
    expect(env.getState().multichain.send).toMatchObject({
      status: OPERATION_STATUS.RECORDED,
      draftId: 'draft-1',
      reason: null,
    });
    expect(env.getState().multichain.next.balances[HTR].data.available).toBe(2395000000n);
  });

  test('is sent at most once per draft (sign-once)', async () => {
    const env = setup();
    await connect(env);
    const sendSpy = jest.spyOn(getNextClient(), 'send');
    env.dispatch(draft('draft-1'));
    await wait(1000);
    env.dispatch(draft('draft-1'));
    await wait(1000);
    expect(sendSpy).toHaveBeenCalledTimes(1);
    expect(env.getState().multichain.next.balances[HTR].data.available).toBe(2395000000n);
  });

  test("carries the network's words when it is turned down", async () => {
    const env = setup({ scenario: MOCK_SCENARIO.SEND_REJECTED });
    await connect(env);
    env.dispatch(draft('draft-1'));
    await wait(1000);
    expect(env.getState().multichain.send).toMatchObject({
      status: OPERATION_STATUS.FAILED,
      reason: expect.any(String),
    });
  });
});

describe('a transfer between chains', () => {
  const transferTo = (toAddress, pinCode = PIN) => multichainTransferRequested({
    amount: 10000n, toAddress, pinCode,
  });

  test("to the wallet's own address is recorded, and arrives after the arrival time", async () => {
    const env = setup({ scenario: MOCK_SCENARIO.EMPTY });
    await connect(env);
    env.dispatch(transferTo(ADDRESS));
    await wait(1000);
    const { multichain } = env.getState();
    expect(multichain.transfer).toMatchObject({
      status: OPERATION_STATUS.DONE,
      record: expect.objectContaining({ toOwn: true, status: TRANSFER_STATUS.PENDING }),
    });
    expect(multichain.transfers).toEqual([
      expect.objectContaining({
        id: multichain.transfer.record.id, status: TRANSFER_STATUS.PENDING,
      }),
    ]);
    expect(multichain.next.balances[HTR].data.available).toBe(0n);
    await wait(120000);
    // 100.00 less the 0.10 bridge fee, in Hathor Next's 8 decimals.
    expect(env.getState().multichain.next.balances[HTR].data.available).toBe(9990000000n);
    expect(env.getState().multichain.transfers[0].status).toBe(TRANSFER_STATUS.ARRIVED);
  });

  test('runs once when asked twice while it runs', async () => {
    const env = setup({ scenario: MOCK_SCENARIO.EMPTY });
    await connect(env);
    env.dispatch(transferTo(ADDRESS));
    env.dispatch(transferTo(ADDRESS));
    await wait(2000);
    expect(loadLedger(NETWORK).transfers).toHaveLength(1);
  });

  test('from a passkey wallet asks for the passkey, and a dismissed one can be confirmed again', async () => {
    const env = setup({ scenario: MOCK_SCENARIO.EMPTY });
    await connect(env);
    STORE.isPasskeyWallet.mockReturnValue(true);
    withPasskeyWords.mockRejectedValue(new PasskeyCancelledError());
    env.dispatch(transferTo(ADDRESS, undefined));
    await wait(1000);
    expect(withPasskeyWords).toHaveBeenCalledTimes(1);
    expect(env.getState().multichain.transfer).toMatchObject({
      status: OPERATION_STATUS.IDLE,
      error: null,
    });
  });
});
