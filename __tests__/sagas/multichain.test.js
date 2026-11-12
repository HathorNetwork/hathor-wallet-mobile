/**
 * Copyright (c) Hathor Labs and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import {
  jest, describe, test, expect, beforeAll, beforeEach, afterEach,
} from '@jest/globals';

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

// Hathor Next is the test fake, on a network the tests give a side chain.
// eslint-disable-next-line global-require
jest.mock('../../src/multichain/chains', () => require('../multichain/fakes/chainsModule'));
// eslint-disable-next-line global-require
jest.mock('../../src/multichain/nextClient', () => require('../multichain/fakes/nextClientModule'));
// eslint-disable-next-line global-require
jest.mock('../../src/multichain/bridge', () => require('../multichain/fakes/bridgeModule'));

/* eslint-disable import/first */
import { runSaga, stdChannel } from 'redux-saga';
import { reducer } from '../../src/reducers/reducer';
import {
  lockScreen,
  multichainConnectSettingChanged,
  multichainDevBackendSet,
  multichainLoadRequested,
  multichainNextHistoryRequested,
  multichainNextKeysDerived,
  multichainNextKeysUnlockRequested,
  multichainNextCreateTokenRequested,
  multichainNextSendRequested,
  multichainNextUpdate,
  multichainTransferRequested,
  networkChanged,
  networkSettingsUpdateState,
  resetWallet,
  featureToggleInitialized,
  setFeatureToggles,
  setFullNodeNetworkName,
  setServerInfo,
  startWalletSuccess,
  types,
  unlockScreen,
} from '../../src/actions';
import {
  MULTICHAIN_DEV_BACKEND_FEATURE_TOGGLE,
  MULTICHAIN_FEATURE_TOGGLE,
  multichainKeyMap,
  PRE_SETTINGS_NEXT_DEVNET,
} from '../../src/constants';
import { STORE } from '../../src/store';
import { nextClientChannel, resolveUncertainTransfer, saga } from '../../src/sagas/multichain';
import { prepareNextKeysAtUnlock } from '../../src/multichain/keys';
import { ensureNextClient, getNextClient, setNextClient } from '../../src/multichain/nextClient';
import { deriveFakeNextAddress, fakePeerAddress } from '../multichain/fakes/fakeAddress';
import { fakeLedgerKey, loadLedger, resetLedger } from '../multichain/fakes/fakeLedger';
import { FAKE_SCENARIO } from '../multichain/fakes/scenarios';
import { FAKE_NETWORK, FAKE_SIDE_CHAIN } from '../multichain/fakes/sideChain';
import { isSideChainAvailable, selectSideChainConfig } from '../../src/multichain/gating';
import {
  CONNECT_STATUS,
  NEXT_STATUS,
  OPERATION_STATUS,
  TRANSFER_STATUS,
} from '../../src/multichain/state';
import * as bridgeModule from '../../src/multichain/bridge';
import {
  NEXT_CLIENT_ERROR,
  NEXT_CLIENT_EVENT,
  NextClientError,
} from '../../src/multichain/nextClientErrors';
import { PasskeyCancelledError, withPasskeyWords } from '../../src/passkey/passkeySigner';
/* eslint-enable import/first */

const NETWORK = FAKE_NETWORK;
const WORDS = 'abandon ability able';
const PIN = '123456';
let ADDRESS = null;
beforeAll(async () => {
  ADDRESS = await deriveFakeNextAddress(WORDS);
});
const HTR = '00';

let task = null;

function setup(options = {}) {
  const {
    flag = true,
    scenario = FAKE_SCENARIO.FUNDED,
    start = true,
    toggles = true,
    network = NETWORK,
    networkSettings = null,
  } = options;
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
  if (networkSettings) {
    dispatch(networkSettingsUpdateState(networkSettings));
  }
  if (toggles) {
    dispatch(setFeatureToggles({ [MULTICHAIN_FEATURE_TOGGLE]: flag }));
    dispatch(featureToggleInitialized());
  }
  dispatch(setServerInfo({ decimal_places: 2 }));
  dispatch(setFullNodeNetworkName(network));
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
  // A reset of the fake ledger keeps its transfers: each test starts with none.
  STORE.removeItem(fakeLedgerKey(NETWORK));
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
  test('waits for Unleash, which picks the client, and then turns it on', async () => {
    const env = setup({ toggles: false });
    env.dispatch(multichainConnectSettingChanged(true, { pinCode: PIN }));
    await wait(10);
    expect(getNextClient()).toBeNull();
    env.dispatch(setFeatureToggles({ [MULTICHAIN_FEATURE_TOGGLE]: true }));
    env.dispatch(featureToggleInitialized());
    await wait(2000);
    expect(env.getState().multichain.connectedNetworks).toEqual({ [NETWORK]: true });
    expect(env.getState().multichain.next.status).toBe(NEXT_STATUS.READY);
  });

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
    const env = setup({ scenario: FAKE_SCENARIO.CONNECT_FAILS });
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

  test('loads when the wallet started before Unleash answered', async () => {
    STORE.setItem(multichainKeyMap.next, { address: ADDRESS, registered: { [NETWORK]: true } });
    STORE.setItem(multichainKeyMap.connectedNetworks, { [NETWORK]: true });
    const env = setup({ start: false, toggles: false });
    env.dispatch(multichainNextKeysUnlockRequested({ pinCode: PIN }));
    env.dispatch(startWalletSuccess());
    await wait(10);
    expect(env.getState().multichain.next.status).toBe(NEXT_STATUS.STOPPED);
    env.dispatch(setFeatureToggles({ [MULTICHAIN_FEATURE_TOGGLE]: true }));
    env.dispatch(featureToggleInitialized());
    await wait(2000);
    expect(env.getState().multichain.next.status).toBe(NEXT_STATUS.READY);
  });

  test("waits for a passkey unlock's keys still being derived", async () => {
    STORE.isPasskeyWallet.mockReturnValue(true);
    STORE.setItem(multichainKeyMap.next, { address: ADDRESS, registered: { [NETWORK]: true } });
    STORE.setItem(multichainKeyMap.connectedNetworks, { [NETWORK]: true });
    const env = setup({ start: false });
    // The passkey unlock starts the derivation and doesn't wait for it; the wallet starts.
    const derivation = prepareNextKeysAtUnlock(WORDS, true);
    env.dispatch(startWalletSuccess());
    await derivation;
    await wait(2000);
    expect(env.getState().multichain.next.status).toBe(NEXT_STATUS.READY);
  });

  test('runs a load that failed without the keys again once a passkey unlock derives them', async () => {
    STORE.isPasskeyWallet.mockReturnValue(true);
    STORE.setItem(multichainKeyMap.next, { address: ADDRESS, registered: { [NETWORK]: true } });
    STORE.setItem(multichainKeyMap.connectedNetworks, { [NETWORK]: true });
    const env = setup();
    await wait(10);
    expect(env.getState().multichain.next.status).toBe(NEXT_STATUS.FAILED);
    await prepareNextKeysAtUnlock(WORDS, true);
    env.dispatch(multichainNextKeysDerived());
    await wait(2000);
    expect(env.getState().multichain.next).toMatchObject({
      status: NEXT_STATUS.READY,
      keysReady: true,
    });
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

  test('loads once the PIN derives the keys when the backend for local testing forgot the address', async () => {
    // What "Use this backend" leaves: the side chain still on, the saved address dropped.
    STORE.setItem(multichainKeyMap.next, { address: null, registered: { [NETWORK]: true } });
    STORE.setItem(multichainKeyMap.connectedNetworks, { [NETWORK]: true });
    const env = setup();
    await wait(10);
    expect(env.getState().multichain.next.status).toBe(NEXT_STATUS.FAILED);
    // The loading screen's Try again locks the app; its PIN derives the keys and loads.
    env.dispatch(multichainNextKeysUnlockRequested({ pinCode: PIN }));
    await wait(2000);
    expect(env.getState().multichain.next).toMatchObject({
      status: NEXT_STATUS.READY, keysReady: true, address: ADDRESS,
    });
  });

  test('tries again from the loading screen', async () => {
    const env = setup();
    await connect(env);
    resetLedger(NETWORK, FAKE_SCENARIO.CONNECT_FAILS);
    await wait(10);
    env.dispatch(networkChanged());
    await wait(10);
    env.dispatch(startWalletSuccess());
    await wait(2000);
    expect(env.getState().multichain.next.status).toBe(NEXT_STATUS.FAILED);
    resetLedger(NETWORK, FAKE_SCENARIO.FUNDED);
    env.dispatch(multichainLoadRequested());
    await wait(2000);
    expect(env.getState().multichain.next.status).toBe(NEXT_STATUS.READY);
  });

  test('waits for the flag: once it comes back on, the next PIN loads it', async () => {
    STORE.setItem(multichainKeyMap.next, { address: ADDRESS, registered: { [NETWORK]: true } });
    STORE.setItem(multichainKeyMap.connectedNetworks, { [NETWORK]: true });
    const env = setup({ flag: false, start: false });
    env.dispatch(multichainNextKeysUnlockRequested({ pinCode: PIN }));
    env.dispatch(startWalletSuccess());
    await wait(2000);
    expect(env.getState().multichain.next.status).toBe(NEXT_STATUS.STOPPED);
    // Nothing of Hathor Next ran while the flag was off, not even its keys.
    expect(STORE.getWalletWords).not.toHaveBeenCalled();
    env.dispatch(setFeatureToggles({ [MULTICHAIN_FEATURE_TOGGLE]: true }));
    env.dispatch({ type: types.FEATURE_TOGGLE_UPDATED });
    await wait(2000);
    expect(env.getState().multichain.next.status).toBe(NEXT_STATUS.FAILED);
    // The loading screen's Try again locks the app; its PIN derives the keys and loads.
    env.dispatch(multichainNextKeysUnlockRequested({ pinCode: PIN }));
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

  test('are left alone while the multichain flag is off, even when the wallet used it', async () => {
    STORE.setItem(multichainKeyMap.next, { address: ADDRESS, registered: { [NETWORK]: true } });
    const env = setup({ flag: false });
    env.dispatch(multichainNextKeysUnlockRequested({ pinCode: PIN }));
    await wait(10);
    expect(STORE.getWalletWords).not.toHaveBeenCalled();
    expect(env.getState().multichain.next.keysReady).toBe(false);
  });

  test("are left alone by a passkey unlock while the flag is off, and derived while it's on", async () => {
    STORE.setItem(multichainKeyMap.next, { address: ADDRESS, registered: { [NETWORK]: true } });
    setup();
    await expect(prepareNextKeysAtUnlock(WORDS, false)).resolves.toBeNull();
    expect(getNextClient()?.hasKeys() ?? false).toBe(false);
    await prepareNextKeysAtUnlock(WORDS, true);
    expect(getNextClient().hasKeys()).toBe(true);
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
    const env = setup({ scenario: FAKE_SCENARIO.FUNDED });
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
    to: fakePeerAddress('someone'),
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

  // The fake ledger's funded scenario holds two tokens besides HTR.
  test('in another token takes its amount from that token, and the fee from HTR', async () => {
    const env = setup();
    await connect(env);
    const { balances } = env.getState().multichain.next;
    const token = Object.keys(balances)
      .find((id) => id !== HTR && balances[id].data.available > 0n);
    const before = { token: balances[token].data.available, htr: balances[HTR].data.available };
    env.dispatch(multichainNextSendRequested({
      tokenId: token, to: fakePeerAddress('someone'), amount: 100000000n, draftId: 'draft-t', pinCode: PIN,
    }));
    await wait(1000);
    expect(env.getState().multichain.send).toMatchObject({
      status: OPERATION_STATUS.RECORDED, draftId: 'draft-t',
    });
    const after = env.getState().multichain.next.balances;
    expect(after[token].data.available).toBe(before.token - 100000000n);
    expect(after[HTR].data.available).toBe(before.htr - 5000000n);
  });

  test("keeps the client's events that come while the saga is busy with another", () => {
    const listeners = {};
    const client = {
      on: (event, listener) => {
        listeners[event] = listener;
        return () => {};
      },
    };
    const channel = nextClientChannel(client);
    // One refresh, before anything takes from the channel: the balance it read and the payment
    // it found recorded. Losing the second leaves the payment screen waiting for good.
    listeners[NEXT_CLIENT_EVENT.BALANCE]();
    listeners[NEXT_CLIENT_EVENT.SEND]({ sendId: 'send-1', status: 'recorded' });
    const taken = [];
    channel.take(({ event }) => taken.push(event));
    channel.take(({ event }) => taken.push(event));
    expect(taken).toEqual([NEXT_CLIENT_EVENT.BALANCE, NEXT_CLIENT_EVENT.SEND]);
    channel.close();
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

  test('waits for the one on its way: another draft sends nothing until it settles', async () => {
    const env = setup();
    await connect(env);
    const sendSpy = jest.spyOn(getNextClient(), 'send');
    env.dispatch(draft('draft-1'));
    env.dispatch(draft('draft-2'));
    await wait(1000);
    expect(sendSpy).toHaveBeenCalledTimes(1);
    expect(env.getState().multichain.send).toMatchObject({
      status: OPERATION_STATUS.RECORDED,
      draftId: 'draft-1',
    });

    env.dispatch(draft('draft-3'));
    await wait(1000);
    expect(sendSpy).toHaveBeenCalledTimes(2);
    expect(env.getState().multichain.send).toMatchObject({
      status: OPERATION_STATUS.RECORDED,
      draftId: 'draft-3',
    });
  });

  test('settles even when it settled before send() returned', async () => {
    const env = setup();
    await connect(env);
    const client = getNextClient();
    const original = client.send.bind(client);
    // The node records in about 130 ms, so the feed's event can come before the backend's
    // answer: the event fires while the saga doesn't know the payment's id yet.
    client.send = async (params) => {
      const result = await original(params);
      await jest.advanceTimersByTimeAsync(1000);
      return result;
    };
    env.dispatch(draft('draft-1'));
    await wait(1000);
    expect(env.getState().multichain.send).toMatchObject({
      status: OPERATION_STATUS.RECORDED,
      draftId: 'draft-1',
    });
  });

  test("carries the network's words when it is turned down", async () => {
    const env = setup({ scenario: FAKE_SCENARIO.SEND_REJECTED });
    await connect(env);
    env.dispatch(draft('draft-1'));
    await wait(1000);
    expect(env.getState().multichain.send).toMatchObject({
      status: OPERATION_STATUS.FAILED,
      reason: expect.any(String),
    });
  });
});

describe('a Hathor Next token creation', () => {
  const SUPPLY = 100000000n;
  const draft = (draftId) => multichainNextCreateTokenRequested({
    symbol: 'ATT',
    name: 'App Test Token',
    amount: SUPPLY,
    draftId,
    pinCode: PIN,
  });

  test('takes the words from the PIN, and the wallet then holds the token\'s supply', async () => {
    const env = setup();
    await connect(env);
    expect(env.getState().multichain.next.canCreateTokens).toBe(true);
    const createSpy = jest.spyOn(getNextClient(), 'createToken');
    env.dispatch(draft('token-1'));
    await wait(1000);
    expect(STORE.getWalletWords).toHaveBeenCalledWith(PIN);
    expect(createSpy).toHaveBeenCalledWith({
      words: WORDS, symbol: 'ATT', name: 'App Test Token', amount: SUPPLY,
    });
    const { createToken, next } = env.getState().multichain;
    expect(createToken).toMatchObject({
      status: OPERATION_STATUS.RECORDED, draftId: 'token-1', error: null,
    });
    expect(next.tokens[createToken.tokenId]).toMatchObject({ symbol: 'ATT', name: 'App Test Token' });
    expect(next.balances[createToken.tokenId].data.available).toBe(SUPPLY);
    // The PIN is in no state.
    expect(JSON.stringify(env.getState().multichain, (k, v) => (
      typeof v === 'bigint' ? v.toString() : v
    ))).not.toContain(PIN);
  });

  test('is created at most once per draft, and one at a time', async () => {
    const env = setup();
    await connect(env);
    const createSpy = jest.spyOn(getNextClient(), 'createToken');
    env.dispatch(draft('token-1'));
    env.dispatch(draft('token-1'));
    env.dispatch(draft('token-2'));
    await wait(1000);
    expect(createSpy).toHaveBeenCalledTimes(1);
    env.dispatch(draft('token-1'));
    await wait(1000);
    expect(createSpy).toHaveBeenCalledTimes(1);
  });

  test('a passkey wallet\'s ceremony gives the words, and dismissing it changes nothing', async () => {
    STORE.isPasskeyWallet.mockReturnValue(true);
    withPasskeyWords.mockImplementation(async (use) => use(WORDS));
    const env = setup();
    await connect(env);
    const createSpy = jest.spyOn(getNextClient(), 'createToken');
    env.dispatch(draft('token-1'));
    await wait(1000);
    expect(createSpy).toHaveBeenCalledWith(expect.objectContaining({ words: WORDS }));
    expect(STORE.getWalletWords).not.toHaveBeenCalledWith(PIN);
    expect(env.getState().multichain.createToken.status).toBe(OPERATION_STATUS.RECORDED);

    withPasskeyWords.mockRejectedValue(new PasskeyCancelledError());
    env.dispatch(draft('token-2'));
    await wait(1000);
    expect(createSpy).toHaveBeenCalledTimes(1);
    expect(env.getState().multichain.createToken).toMatchObject({
      status: OPERATION_STATUS.IDLE, draftId: null,
    });
  });

  test('a creation refused before signing says why', async () => {
    const env = setup();
    await connect(env);
    jest.spyOn(getNextClient(), 'createToken')
      .mockRejectedValue(new NextClientError(NEXT_CLIENT_ERROR.TOKEN_REFUSED));
    env.dispatch(draft('token-1'));
    await wait(1000);
    expect(env.getState().multichain.createToken).toMatchObject({
      status: OPERATION_STATUS.ERROR,
      error: new NextClientError(NEXT_CLIENT_ERROR.TOKEN_REFUSED).message,
    });
  });

  test('the network turning it down is a failure with its words', async () => {
    const env = setup({ scenario: FAKE_SCENARIO.SEND_REJECTED });
    await connect(env);
    env.dispatch(draft('token-1'));
    await wait(1000);
    expect(env.getState().multichain.createToken).toMatchObject({
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
    const env = setup({ scenario: FAKE_SCENARIO.EMPTY });
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
    const env = setup({ scenario: FAKE_SCENARIO.EMPTY });
    await connect(env);
    env.dispatch(transferTo(ADDRESS));
    env.dispatch(transferTo(ADDRESS));
    await wait(2000);
    expect(loadLedger(NETWORK).transfers).toHaveLength(1);
  });

  test('from a passkey wallet asks for the passkey, and a dismissed one can be confirmed again', async () => {
    const env = setup({ scenario: FAKE_SCENARIO.EMPTY });
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

describe('a transfer signed without an answer', () => {
  const run = (bridge, tries) => {
    const dispatched = [];
    const done = runSaga(
      { dispatch: (action) => dispatched.push(action), getState: () => ({}) },
      resolveUncertainTransfer,
      bridge,
      'transfer-1',
      tries,
    ).toPromise();
    return { dispatched, done };
  };

  test('is asked about until the backend answers, and ends as not sent when it never left', async () => {
    const bridge = {
      resolveTransfer: jest.fn()
        .mockRejectedValueOnce(new Error('unreachable'))
        .mockResolvedValueOnce(null),
    };
    const { dispatched, done } = run(bridge, 3);
    await jest.advanceTimersByTimeAsync(3000);
    await expect(done).resolves.toBe(true);
    expect(bridge.resolveTransfer).toHaveBeenCalledTimes(2);
    expect(dispatched).toContainEqual(expect.objectContaining({
      payload: expect.objectContaining({ status: OPERATION_STATUS.ERROR, uncertainId: null }),
    }));
  });

  test('stays unsettled while the backend can\'t be read', async () => {
    const bridge = { resolveTransfer: jest.fn().mockRejectedValue(new Error('unreachable')) };
    const { dispatched, done } = run(bridge, 2);
    await jest.advanceTimersByTimeAsync(3000);
    await expect(done).resolves.toBe(false);
    expect(dispatched).toEqual([]);
  });

  test('is asked about by one asker at a time', async () => {
    const bridge = { resolveTransfer: jest.fn().mockRejectedValue(new Error('unreachable')) };
    const first = run(bridge, 2);
    const second = run(bridge, 2);
    await expect(second.done).resolves.toBe(false);
    expect(bridge.resolveTransfer).toHaveBeenCalledTimes(1);
    await jest.advanceTimersByTimeAsync(3000);
    await expect(first.done).resolves.toBe(false);
    expect(bridge.resolveTransfer).toHaveBeenCalledTimes(2);
  });

  test('is asked about again while the transfers are read, after its first tries ran out', async () => {
    const env = setup({ scenario: FAKE_SCENARIO.EMPTY });
    await connect(env);
    let reachable = false;
    const bridge = {
      transfer: jest.fn(async () => {
        throw new NextClientError(NEXT_CLIENT_ERROR.TRANSFER_UNCERTAIN, { transferId: 'transfer-1' });
      }),
      // The backend answers again only after the first tries ran out: the burn never left.
      resolveTransfer: jest.fn(async () => {
        if (!reachable) {
          throw new Error('unreachable');
        }
        return null;
      }),
      getTransfers: jest.fn(async () => []),
    };
    jest.spyOn(bridgeModule, 'createBridge').mockReturnValue(bridge);
    env.dispatch(multichainTransferRequested({ amount: 10000n, toAddress: ADDRESS, pinCode: PIN }));
    await wait(31000);
    expect(env.getState().multichain.transfer).toMatchObject({
      status: OPERATION_STATUS.UNCONFIRMED,
      uncertainId: 'transfer-1',
    });
    reachable = true;
    await wait(15000);
    expect(env.getState().multichain.transfer).toMatchObject({
      status: OPERATION_STATUS.ERROR,
      uncertainId: null,
    });
  });
});

describe('the backend for local testing', () => {
  test('stays unused while its flag is off, even when one was saved', async () => {
    STORE.setItem(multichainKeyMap.devBackend, {
      url: 'http://192.168.0.10:8930',
      pins: { next: { network_id: 1777 }, transfer: null },
    });
    try {
      const env = setup();
      await connect(env);
      expect(selectSideChainConfig(env.getState())).toBe(FAKE_SIDE_CHAIN);
      expect(env.getState().multichain.next.status).toBe(NEXT_STATUS.READY);
    } finally {
      STORE.removeItem(multichainKeyMap.devBackend);
    }
  });

  // The keys are the same on every backend: a switch keeps them, and only the address changes.
  test('loads Hathor Next again at once with the PIN Settings asked for the switch', async () => {
    const env = setup();
    await connect(env);
    env.dispatch(multichainDevBackendSet(null, { pinCode: PIN }));
    await wait(2000);
    expect(env.getState().multichain.next).toMatchObject({
      status: NEXT_STATUS.READY, keysReady: true, address: ADDRESS,
    });
  });

  test('loads it again for a passkey wallet with the keys its first ceremony derived', async () => {
    STORE.isPasskeyWallet.mockReturnValue(true);
    withPasskeyWords.mockImplementation(async (fn) => fn(WORDS));
    const env = setup();
    env.dispatch(multichainConnectSettingChanged(true));
    await wait(2000);
    env.dispatch(multichainDevBackendSet(null));
    await wait(2000);
    expect(withPasskeyWords).toHaveBeenCalledTimes(1);
    expect(env.getState().multichain.next).toMatchObject({
      status: NEXT_STATUS.READY, address: ADDRESS,
    });
  });
});

describe('Hathor Next Devnet', () => {
  // The client here is the tests' fake: what matters is the side chain it connects with.
  test("connects to devnet-alpha's backend, with no backend set for local testing", async () => {
    const env = setup({ network: 'privatenet', networkSettings: PRE_SETTINGS_NEXT_DEVNET });
    await wait(0);
    const connectSpy = jest.spyOn(ensureNextClient(), 'connect');
    await connect(env);
    expect(connectSpy).toHaveBeenCalledWith(expect.objectContaining({
      network: 'privatenet',
      config: expect.objectContaining({
        backendUrl: 'https://wallet-backend.devnet-alpha.samba.hathor.network',
      }),
    }));
    expect(env.getState().multichain.connectedNetworks).toEqual({ privatenet: true });
  });

  test('has no side chain on another privatenet, so Settings offers none', async () => {
    const env = setup({
      network: 'privatenet',
      networkSettings: { ...PRE_SETTINGS_NEXT_DEVNET, nodeUrl: 'http://192.168.0.10:8080/v1a/' },
    });
    await wait(0);
    expect(selectSideChainConfig(env.getState())).toBeNull();
    expect(isSideChainAvailable(env.getState())).toBe(false);
  });
});

describe('the flag of the backend for local testing', () => {
  const LOCAL = {
    url: 'http://192.168.0.10:8930',
    pins: {
      next: {
        network_id: 1777, native_token: '00', service_view_pub: 'ab', wire_format: 'v3',
      },
      transfer: null,
    },
  };

  // The keys are the same on every backend: only the backend and the address change.
  test('loads Hathor Next again on the local backend when it turns on, with the same keys', async () => {
    STORE.setItem(multichainKeyMap.devBackend, LOCAL);
    try {
      const env = setup();
      await connect(env);
      const client = getNextClient();
      const connectSpy = jest.spyOn(client, 'connect');
      env.dispatch(setFeatureToggles({
        [MULTICHAIN_FEATURE_TOGGLE]: true, [MULTICHAIN_DEV_BACKEND_FEATURE_TOGGLE]: true,
      }));
      env.dispatch({ type: types.FEATURE_TOGGLE_UPDATED });
      await wait(2000);
      expect(connectSpy).toHaveBeenCalledWith(expect.objectContaining({
        config: expect.objectContaining({ backendUrl: LOCAL.url }),
      }));
      expect(getNextClient()).toBe(client);
      expect(env.getState().multichain.next).toMatchObject({
        status: NEXT_STATUS.READY, keysReady: true,
      });
    } finally {
      STORE.removeItem(multichainKeyMap.devBackend);
    }
  });

  test("goes back to the network's own side chain when it turns off", async () => {
    STORE.setItem(multichainKeyMap.devBackend, LOCAL);
    try {
      const env = setup({ toggles: false });
      env.dispatch(setFeatureToggles({
        [MULTICHAIN_FEATURE_TOGGLE]: true, [MULTICHAIN_DEV_BACKEND_FEATURE_TOGGLE]: true,
      }));
      env.dispatch(featureToggleInitialized());
      await connect(env);
      const connectSpy = jest.spyOn(getNextClient(), 'connect');
      env.dispatch(setFeatureToggles({ [MULTICHAIN_FEATURE_TOGGLE]: true }));
      env.dispatch({ type: types.FEATURE_TOGGLE_UPDATED });
      await wait(2000);
      expect(connectSpy).toHaveBeenCalledWith(expect.objectContaining({ config: FAKE_SIDE_CHAIN }));
      expect(env.getState().multichain.next.status).toBe(NEXT_STATUS.READY);
    } finally {
      STORE.removeItem(multichainKeyMap.devBackend);
    }
  });

  test('leaves Hathor Next alone when nothing about the backend changed', async () => {
    const env = setup();
    await connect(env);
    const connectSpy = jest.spyOn(getNextClient(), 'connect');
    env.dispatch({ type: types.FEATURE_TOGGLE_UPDATED });
    await wait(2000);
    expect(connectSpy).not.toHaveBeenCalled();
    expect(env.getState().multichain.next.status).toBe(NEXT_STATUS.READY);
  });
});

describe('locking the app', () => {
  test('drops the Hathor Next keys of a client that holds real ones, and only on lock', async () => {
    const env = setup();
    const forgetKeys = jest.fn(() => true);
    setNextClient({ forgetKeys, disconnect: jest.fn() });
    env.dispatch(multichainNextUpdate({ keysReady: true }));
    env.dispatch(unlockScreen());
    expect(forgetKeys).not.toHaveBeenCalled();
    env.dispatch(lockScreen());
    expect(forgetKeys).toHaveBeenCalledTimes(1);
    expect(env.getState().multichain.next.keysReady).toBe(false);
  });

  test('drops them even before Unleash answered', async () => {
    const env = setup({ start: false, toggles: false });
    const forgetKeys = jest.fn(() => true);
    setNextClient({ forgetKeys, disconnect: jest.fn() });
    env.dispatch(lockScreen());
    expect(forgetKeys).toHaveBeenCalledTimes(1);
  });

  test('keeps keysReady when the client had nothing to drop', async () => {
    const env = setup();
    await connect(env);
    env.dispatch(lockScreen());
    expect(getNextClient().hasKeys()).toBe(true);
    expect(env.getState().multichain.next.keysReady).toBe(true);
  });
});
