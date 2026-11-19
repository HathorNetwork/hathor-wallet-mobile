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
import { put } from 'redux-saga/effects';
import { reducer } from '../../src/reducers/reducer';
import {
  lockScreen,
  multichainConnectSettingChanged,
  multichainDevBackendSet,
  multichainLoadRequested,
  multichainNextHistoryRequested,
  multichainNextKeysDerived,
  multichainNextKeysUnlockRequested,
  multichainNextSendRequested,
  multichainNextSendReset,
  multichainNextSendUpdate,
  multichainNextUpdate,
  multichainTransferForgottenSeen,
  multichainTransferRequested,
  multichainTransferReset,
  multichainTransferUpdate,
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
  FEATURE_TOGGLE_DEFAULTS,
  MULTICHAIN_DEV_BACKEND_FEATURE_TOGGLE,
  MULTICHAIN_FEATURE_TOGGLE,
  multichainKeyMap,
  PRE_SETTINGS_MAINNET,
  PRE_SETTINGS_NEXT_DEVNET,
  PRE_SETTINGS_TESTNET,
} from '../../src/constants';
import { STORE } from '../../src/store';
import {
  nextClientChannel,
  resolveUncertainTransfer,
  saga,
  SEND_SETTLE_MS,
} from '../../src/sagas/multichain';
import { prepareNextKeysAtUnlock } from '../../src/multichain/keys';
import { ensureNextClient, getNextClient, setNextClient } from '../../src/multichain/nextClient';
import { deriveFakeNextAddress, fakePeerAddress } from '../multichain/fakes/fakeAddress';
import { fakeLedgerKey, loadLedger, resetLedger } from '../multichain/fakes/fakeLedger';
import { FAKE_SCENARIO } from '../multichain/fakes/scenarios';
import { FAKE_NETWORK, FAKE_SIDE_CHAIN } from '../multichain/fakes/sideChain';
import {
  isSideChainAvailable,
  isSideChainConnected,
  selectSideChainConfig,
  selectSideChainKey,
} from '../../src/multichain/gating';
import {
  CONNECT_STATUS,
  NEXT_STATUS,
  OPERATION_STATUS,
  SEND_IN_FLIGHT,
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
    // The wallet's saved network settings: Hathor Next never shows on mainnet's.
    networkSettings = PRE_SETTINGS_TESTNET,
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
  // A test's own saga runs on the same store.
  const io = { channel, dispatch, getState: () => state };
  task = runSaga(io, saga);
  dispatch(networkSettingsUpdateState(networkSettings));
  if (toggles) {
    dispatch(setFeatureToggles({ [MULTICHAIN_FEATURE_TOGGLE]: flag }));
    dispatch(featureToggleInitialized());
  }
  dispatch(setServerInfo({ decimal_places: 2 }));
  dispatch(setFullNodeNetworkName(network));
  if (start) {
    dispatch(startWalletSuccess());
  }
  return { getState: () => state, dispatch, dispatched, io };
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

// A backend for local testing, saved: its flag turns it on.
const LOCAL_BACKEND = {
  url: 'http://192.168.0.10:8930',
  pins: {
    next: {
      network_id: 1777, native_token: '00', service_view_pub: 'ab', wire_format: 'v3',
    },
    transfer: null,
  },
};

// Turns the backend for local testing on, or off, as an Unleash update does.
function devBackendFlag(env, on) {
  env.dispatch(setFeatureToggles({
    [MULTICHAIN_FEATURE_TOGGLE]: true, [MULTICHAIN_DEV_BACKEND_FEATURE_TOGGLE]: on,
  }));
  env.dispatch({ type: types.FEATURE_TOGGLE_UPDATED });
}

// The state of a wallet on NETWORK, on its side chain's own backend or on the one for local
// testing: where a transfer's record says it was signed.
function placeState({ devBackend = null } = {}) {
  const state = [
    networkSettingsUpdateState(PRE_SETTINGS_TESTNET),
    setFeatureToggles({
      [MULTICHAIN_FEATURE_TOGGLE]: true,
      [MULTICHAIN_DEV_BACKEND_FEATURE_TOGGLE]: Boolean(devBackend),
    }),
    setServerInfo({ decimal_places: 2 }),
    setFullNodeNetworkName(NETWORK),
  ].reduce(reducer, reducer(undefined, { type: '@@INIT' }));
  return devBackend ? { ...state, multichain: { ...state.multichain, devBackend } } : state;
}

// The record of 'transfer-1', signed without an answer on NETWORK's own backend.
const SAVED_HERE = { id: 'transfer-1', network: NETWORK, backendUrl: null };

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

  // A retry of Unleash that answers puts the flags alone: no "flags updated" action comes.
  test('waits for the flag: it loads when a retry of Unleash brings the flag back on', async () => {
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
    env.dispatch(featureToggleInitialized());
    await wait(2000);
    expect(env.dispatched.map((action) => action.type)).not.toContain(types.FEATURE_TOGGLE_UPDATED);
    expect(env.getState().multichain.next.status).toBe(NEXT_STATUS.FAILED);
    // The loading screen's Try again locks the app; its PIN derives the keys and loads.
    env.dispatch(multichainNextKeysUnlockRequested({ pinCode: PIN }));
    await wait(2000);
    expect(env.getState().multichain.next.status).toBe(NEXT_STATUS.READY);
  });

  // The flags are set at every wallet start, Unleash retry and poll that finds a change.
  test('loads nothing when the flags are set where the side chain is not connected', async () => {
    // The wallet used Hathor Next before, so the unlock derives its keys; "Connect to side chain"
    // is off on this network.
    STORE.setItem(multichainKeyMap.next, { address: ADDRESS, registered: { [NETWORK]: true } });
    const env = setup({ start: false });
    env.dispatch(multichainNextKeysUnlockRequested({ pinCode: PIN }));
    await wait(10);
    env.dispatch(startWalletSuccess());
    await wait(2000);
    expect(getNextClient().hasKeys()).toBe(true);
    const connectSpy = jest.spyOn(getNextClient(), 'connect');
    env.dispatch(setFeatureToggles({ [MULTICHAIN_FEATURE_TOGGLE]: true }));
    env.dispatch(featureToggleInitialized());
    await wait(2000);
    expect(connectSpy).not.toHaveBeenCalled();
    expect(env.getState().multichain.next.status).toBe(NEXT_STATUS.STOPPED);
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
  let state = null;
  afterEach(() => STORE.removeItem(multichainKeyMap.uncertainTransfer));
  const run = (bridge, tries) => {
    state = placeState();
    STORE.setItem(multichainKeyMap.uncertainTransfer, SAVED_HERE);
    const dispatched = [];
    const done = runSaga(
      { dispatch: (action) => dispatched.push(action), getState: () => state },
      resolveUncertainTransfer,
      bridge,
      { id: 'transfer-1', inputs: null },
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

  test('is no longer asked about once the wallet is on another backend', async () => {
    const bridge = {
      // Asked there, the backend for local testing would never have known it.
      resolveTransfer: jest.fn(async () => {
        throw new NextClientError(NEXT_CLIENT_ERROR.TRANSFER_FORGOTTEN);
      }).mockRejectedValueOnce(new Error('unreachable')),
    };
    const { dispatched, done } = run(bridge, 3);
    await jest.advanceTimersByTimeAsync(0);
    state = placeState({ devBackend: LOCAL_BACKEND });
    await jest.advanceTimersByTimeAsync(6000);
    await expect(done).resolves.toBe(false);
    expect(bridge.resolveTransfer).toHaveBeenCalledTimes(1);
    expect(dispatched).toEqual([]);
    // Left as it was: the background check asks again back on its backend.
    expect(STORE.getItem(multichainKeyMap.uncertainTransfer)).toEqual(SAVED_HERE);
  });

  test.each([
    ['no longer knows it', async () => {
      throw new NextClientError(NEXT_CLIENT_ERROR.TRANSFER_FORGOTTEN);
    }],
    ['has it', async () => ({ id: 'transfer-1', status: TRANSFER_STATUS.PENDING })],
    ['says it never left', async () => null],
  ])('settles nothing when the backend changed while it was asked, whose answer %s', async (_label, answer) => {
    const bridge = {
      resolveTransfer: jest.fn(async () => {
        state = placeState({ devBackend: LOCAL_BACKEND });
        return answer();
      }),
    };
    const { dispatched, done } = run(bridge, 1);
    await expect(done).resolves.toBe(false);
    expect(dispatched).toEqual([]);
    expect(STORE.getItem(multichainKeyMap.uncertainTransfer)).toEqual(SAVED_HERE);
  });

  test('is saved with the backend it was signed on, though another took over meanwhile', async () => {
    STORE.setItem(multichainKeyMap.devBackend, LOCAL_BACKEND);
    try {
      const env = setup({ scenario: FAKE_SCENARIO.EMPTY });
      await connect(env);
      const bridge = {
        transfer: jest.fn(async () => {
          devBackendFlag(env, true);
          throw new NextClientError(NEXT_CLIENT_ERROR.TRANSFER_UNCERTAIN, { transferId: 'transfer-1' });
        }),
        resolveTransfer: jest.fn(async () => {
          throw new NextClientError(NEXT_CLIENT_ERROR.TRANSFER_FORGOTTEN);
        }),
        getTransfers: async () => [],
      };
      jest.spyOn(bridgeModule, 'createBridge').mockReturnValue(bridge);
      env.dispatch(multichainTransferRequested({
        amount: 10000n, toAddress: ADDRESS, pinCode: PIN,
      }));
      await wait(31000);
      expect(STORE.getItem(multichainKeyMap.uncertainTransfer))
        .toEqual({ ...SAVED_HERE, inputs: null });
      expect(bridge.resolveTransfer).not.toHaveBeenCalled();
    } finally {
      STORE.removeItem(multichainKeyMap.devBackend);
    }
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

describe('a transfer that settles', () => {
  afterEach(() => STORE.removeItem(multichainKeyMap.uncertainTransfer));
  const run = (bridge) => {
    const state = placeState();
    STORE.setItem(multichainKeyMap.uncertainTransfer, SAVED_HERE);
    const dispatched = [];
    const done = runSaga(
      { dispatch: (action) => dispatched.push(action), getState: () => state },
      resolveUncertainTransfer,
      bridge,
      { id: 'transfer-1', inputs: null },
      1,
    ).toPromise();
    return { dispatched, done };
  };
  const record = (status) => ({ id: 'transfer-1', status, reason: 'inputs spent' });

  test('as sent stays done when reading the transfers again fails', async () => {
    const bridge = {
      resolveTransfer: async () => record(TRANSFER_STATUS.PENDING),
      getTransfers: async () => { throw new Error('unreachable'); },
    };
    jest.spyOn(bridgeModule, 'createBridge').mockReturnValue(bridge);
    const { dispatched, done } = run(bridge);
    await expect(done).resolves.toBe(true);
    const statuses = dispatched.map((a) => a.payload?.status).filter(Boolean);
    expect(statuses).toEqual([OPERATION_STATUS.DONE]);
  });

  test('as refused by hathor-core is not sent, never done', async () => {
    const bridge = { resolveTransfer: async () => record(TRANSFER_STATUS.FAILED) };
    const { dispatched, done } = run(bridge);
    await expect(done).resolves.toBe(true);
    expect(dispatched.map((a) => a.payload?.status)).toEqual([OPERATION_STATUS.ERROR]);
    expect(dispatched[0].payload.error).toBe("The transfer didn't go through. Nothing left your wallet.");
  });

  test('refused by hathor-core as soon as it is signed shows no success', async () => {
    const env = setup({ scenario: FAKE_SCENARIO.EMPTY });
    await connect(env);
    jest.spyOn(bridgeModule, 'createBridge').mockReturnValue({
      transfer: async () => ({ id: 'transfer-1', status: TRANSFER_STATUS.FAILED, reason: 'spent' }),
      getTransfers: async () => [],
    });
    env.dispatch(multichainTransferRequested({ amount: 10000n, toAddress: ADDRESS, pinCode: PIN }));
    await wait(1000);
    expect(env.getState().multichain.transfer).toMatchObject({
      status: OPERATION_STATUS.ERROR,
      error: "The transfer didn't go through. Nothing left your wallet.",
    });
  });
});

describe('a transfer signed without an answer, kept where it was signed', () => {
  afterEach(() => STORE.removeItem(multichainKeyMap.uncertainTransfer));

  test('is asked about after a restart, before another transfer starts', async () => {
    STORE.setItem(multichainKeyMap.uncertainTransfer, {
      id: 'transfer-1', network: NETWORK, backendUrl: null,
    });
    const env = setup({ scenario: FAKE_SCENARIO.EMPTY });
    await connect(env);
    const bridge = {
      transfer: jest.fn(async () => ({ id: 'transfer-2', status: TRANSFER_STATUS.PENDING })),
      resolveTransfer: jest.fn(async () => { throw new Error('unreachable'); }),
      getTransfers: async () => [],
    };
    jest.spyOn(bridgeModule, 'createBridge').mockReturnValue(bridge);
    env.dispatch(multichainTransferRequested({ amount: 10000n, toAddress: ADDRESS, pinCode: PIN }));
    await wait(1000);
    expect(bridge.resolveTransfer).toHaveBeenCalledWith('transfer-1', { inputs: undefined });
    expect(bridge.transfer).not.toHaveBeenCalled();
  });

  test('is not asked about on another backend, where a transfer can start', async () => {
    STORE.setItem(multichainKeyMap.uncertainTransfer, {
      id: 'transfer-1', network: NETWORK, backendUrl: 'http://another.backend',
    });
    const env = setup({ scenario: FAKE_SCENARIO.EMPTY });
    await connect(env);
    const bridge = {
      transfer: jest.fn(async () => ({ id: 'transfer-2', status: TRANSFER_STATUS.PENDING })),
      resolveTransfer: jest.fn(async () => null),
      getTransfers: async () => [],
    };
    jest.spyOn(bridgeModule, 'createBridge').mockReturnValue(bridge);
    env.dispatch(multichainTransferRequested({ amount: 10000n, toAddress: ADDRESS, pinCode: PIN }));
    await wait(1000);
    expect(bridge.resolveTransfer).not.toHaveBeenCalled();
    expect(bridge.transfer).toHaveBeenCalled();
  });
});

describe('a transfer signed without an answer, as the screens see it', () => {
  afterEach(() => STORE.removeItem(multichainKeyMap.uncertainTransfer));
  const saved = (extra = {}) => STORE.setItem(multichainKeyMap.uncertainTransfer, {
    id: 'transfer-1', network: NETWORK, backendUrl: null, ...extra,
  });

  test('shows as not confirmed from the start, so no confirm screen takes it for its own', async () => {
    saved();
    const env = setup({ scenario: FAKE_SCENARIO.EMPTY });
    await wait(0);
    expect(env.getState().multichain.transfer).toMatchObject({
      status: OPERATION_STATUS.UNCONFIRMED,
      uncertainId: 'transfer-1',
      requestId: null,
    });
  });

  test('keeps the outcome of the confirm screen that sent it, and of no other', async () => {
    saved();
    const env = setup({ scenario: FAKE_SCENARIO.EMPTY });
    await connect(env);
    const bridge = {
      transfer: jest.fn(),
      resolveTransfer: jest.fn(async () => ({ id: 'transfer-1', status: TRANSFER_STATUS.PENDING })),
      getTransfers: async () => [],
    };
    jest.spyOn(bridgeModule, 'createBridge').mockReturnValue(bridge);
    env.dispatch(multichainTransferRequested({
      amount: 500n, toAddress: ADDRESS, pinCode: PIN, requestId: 'screen-2',
    }));
    await wait(1000);
    // The earlier transfer went through: that is the outcome, and not this screen's.
    expect(bridge.transfer).not.toHaveBeenCalled();
    expect(env.getState().multichain.transfer.status).toBe(OPERATION_STATUS.DONE);
    expect(env.getState().multichain.transfer.requestId).not.toBe('screen-2');
  });

  test('the backend no longer knows ends, and the user hears it before the next transfer goes', async () => {
    saved({ inputs: [{ txId: '01'.repeat(32), index: 1 }] });
    const env = setup({ scenario: FAKE_SCENARIO.EMPTY });
    await connect(env);
    const bridge = {
      transfer: jest.fn(async () => ({ id: 'transfer-2', status: TRANSFER_STATUS.PENDING })),
      resolveTransfer: jest.fn(async () => {
        throw new NextClientError(NEXT_CLIENT_ERROR.TRANSFER_FORGOTTEN);
      }),
      getTransfers: async () => [],
    };
    jest.spyOn(bridgeModule, 'createBridge').mockReturnValue(bridge);
    const request = multichainTransferRequested({
      amount: 500n, toAddress: ADDRESS, pinCode: PIN, requestId: 'screen-2',
    });
    env.dispatch(request);
    await wait(1000);
    expect(bridge.resolveTransfer).toHaveBeenCalledWith('transfer-1', {
      inputs: [{ txId: '01'.repeat(32), index: 1 }],
    });
    // No longer asked about: kept as forgotten, until the user dismisses it.
    expect(STORE.getItem(multichainKeyMap.uncertainTransfer)).toMatchObject({ forgotten: true });
    // Its HTR may have left the wallet: nothing else burns before the user hears so, as the
    // earlier transfer's outcome.
    expect(bridge.transfer).not.toHaveBeenCalled();
    expect(env.getState().multichain.transfer).toMatchObject({
      status: OPERATION_STATUS.ERROR,
      errorCode: NEXT_CLIENT_ERROR.TRANSFER_FORGOTTEN,
      uncertainId: null,
    });
    expect(env.getState().multichain.transfer.requestId).not.toBe('screen-2');
    // Dismissed, and confirmed again, with nothing left to ask: it goes ahead.
    env.dispatch(multichainTransferForgottenSeen());
    env.dispatch(request);
    await wait(1000);
    expect(bridge.transfer).toHaveBeenCalledTimes(1);
  });

  test('found forgotten by the poll shows until the user dismisses it, across a restart', async () => {
    saved({ inputs: [{ txId: '01'.repeat(32), index: 1 }] });
    let env = setup({ scenario: FAKE_SCENARIO.EMPTY });
    await connect(env);
    jest.spyOn(bridgeModule, 'createBridge').mockReturnValue({
      resolveTransfer: async () => {
        throw new NextClientError(NEXT_CLIENT_ERROR.TRANSFER_FORGOTTEN);
      },
      getTransfers: async () => [],
    });
    // No confirm screen is open: the "not confirmed" one's only way out was Close.
    await wait(16000);
    const forgotten = {
      status: OPERATION_STATUS.ERROR,
      errorCode: NEXT_CLIENT_ERROR.TRANSFER_FORGOTTEN,
      uncertainId: null,
    };
    expect(env.getState().multichain.transfer).toMatchObject(forgotten);
    // A confirm screen opening clears its state: this outcome stays, for it to show.
    env.dispatch(multichainTransferReset());
    expect(env.getState().multichain.transfer).toMatchObject(forgotten);
    // Saved as forgotten: no longer asked about, and the next transfer isn't held by it.
    expect(STORE.getItem(multichainKeyMap.uncertainTransfer)).toMatchObject({
      id: 'transfer-1', forgotten: true,
    });

    task.cancel();
    env = setup({ scenario: FAKE_SCENARIO.EMPTY });
    await wait(0);
    expect(env.getState().multichain.transfer).toMatchObject({ ...forgotten, requestId: null });

    env.dispatch(multichainTransferForgottenSeen());
    await wait(0);
    expect(env.getState().multichain.transfer).toMatchObject({
      status: OPERATION_STATUS.IDLE, errorCode: null,
    });
    expect(STORE.getItem(multichainKeyMap.uncertainTransfer)).toBeNull();
  });

  const FORGOTTEN = {
    status: OPERATION_STATUS.ERROR,
    errorCode: NEXT_CLIENT_ERROR.TRANSFER_FORGOTTEN,
    uncertainId: null,
  };

  test('ended forgotten holds a transfer asked for before its notice showed', async () => {
    saved({ inputs: null, forgotten: true });
    const env = setup({ scenario: FAKE_SCENARIO.EMPTY });
    await connect(env);
    const bridge = {
      transfer: jest.fn(async () => ({ id: 'transfer-2', status: TRANSFER_STATUS.PENDING })),
      resolveTransfer: jest.fn(),
      getTransfers: async () => [],
    };
    jest.spyOn(bridgeModule, 'createBridge').mockReturnValue(bridge);
    // Its notice isn't shown (a flag update was still on its way while the PIN screen was open),
    // and biometrics confirm with no tap.
    env.dispatch(multichainTransferUpdate({ status: OPERATION_STATUS.IDLE, errorCode: null }));
    env.dispatch(multichainTransferRequested({
      amount: 500n, toAddress: ADDRESS, pinCode: PIN, requestId: 'screen-2',
    }));
    await wait(1000);
    expect(bridge.transfer).not.toHaveBeenCalled();
    expect(bridge.resolveTransfer).not.toHaveBeenCalled();
    // The notice shows now, as an earlier transfer's.
    expect(env.getState().multichain.transfer).toMatchObject({ ...FORGOTTEN, requestId: null });
  });

  test('ended forgotten is never asked about by the background check', async () => {
    saved({ inputs: null, forgotten: true });
    const env = setup({ scenario: FAKE_SCENARIO.EMPTY });
    await connect(env);
    const bridge = { resolveTransfer: jest.fn(async () => null), getTransfers: async () => [] };
    jest.spyOn(bridgeModule, 'createBridge').mockReturnValue(bridge);
    await wait(31000);
    expect(bridge.resolveTransfer).not.toHaveBeenCalled();
    expect(env.getState().multichain.transfer).toMatchObject(FORGOTTEN);
  });

  test('ended forgotten shows on its own network only, and again back there', async () => {
    saved({ inputs: null, forgotten: true });
    const env = setup({ scenario: FAKE_SCENARIO.EMPTY });
    await wait(0);
    expect(env.getState().multichain.transfer).toMatchObject(FORGOTTEN);
    env.dispatch(setFullNodeNetworkName('testnet-other'));
    env.dispatch(startWalletSuccess());
    await wait(0);
    expect(env.getState().multichain.transfer).toMatchObject({
      status: OPERATION_STATUS.IDLE, errorCode: null,
    });
    env.dispatch(setFullNodeNetworkName(NETWORK));
    env.dispatch(startWalletSuccess());
    await wait(0);
    expect(env.getState().multichain.transfer).toMatchObject(FORGOTTEN);
  });

  test('a dismissal of a forgotten one leaves one still not confirmed as it is', async () => {
    saved();
    const env = setup({ scenario: FAKE_SCENARIO.EMPTY });
    await wait(0);
    env.dispatch(multichainTransferForgottenSeen());
    await wait(0);
    expect(env.getState().multichain.transfer).toMatchObject({
      status: OPERATION_STATUS.UNCONFIRMED, uncertainId: 'transfer-1',
    });
    expect(STORE.getItem(multichainKeyMap.uncertainTransfer)).toMatchObject({ id: 'transfer-1' });
  });

  test('is not shown on the backend that took over while it was asked about', async () => {
    STORE.setItem(multichainKeyMap.devBackend, LOCAL_BACKEND);
    saved();
    try {
      const env = setup({ scenario: FAKE_SCENARIO.EMPTY });
      await connect(env);
      const bridge = {
        transfer: jest.fn(),
        resolveTransfer: jest.fn(async () => {
          devBackendFlag(env, true);
          await new Promise((resolve) => { setTimeout(resolve, 5000); });
          throw new Error('unreachable');
        }),
        getTransfers: async () => [],
      };
      jest.spyOn(bridgeModule, 'createBridge').mockReturnValue(bridge);
      env.dispatch(multichainTransferRequested({ amount: 500n, toAddress: ADDRESS, pinCode: PIN }));
      await wait(6000);
      expect(bridge.transfer).not.toHaveBeenCalled();
      // The local backend never had it: no confirm screen there is held by it.
      expect(env.getState().multichain.transfer).toMatchObject({
        status: OPERATION_STATUS.IDLE, uncertainId: null,
      });
      expect(STORE.getItem(multichainKeyMap.uncertainTransfer)).toEqual(SAVED_HERE);
    } finally {
      STORE.removeItem(multichainKeyMap.devBackend);
    }
  });

  // The tester transfers on the backend for local testing, and the flag turns it off while the
  // confirm screen still shows that transfer: done, refused, or still on its way.
  const PENDING = { id: 'transfer-2', status: TRANSFER_STATUS.PENDING };
  const REFUSED = { id: 'transfer-2', status: TRANSFER_STATUS.FAILED, reason: 'spent' };
  test.each([
    ['done', false, PENDING, { status: OPERATION_STATUS.DONE, errorCode: null }],
    ['refused', false, REFUSED, {
      status: OPERATION_STATUS.ERROR, errorCode: NEXT_CLIENT_ERROR.TRANSFER_NOT_SENT,
    }],
    ['on its way', true, PENDING, { status: OPERATION_STATUS.DONE, errorCode: null }],
  ])('ended forgotten never covers a transfer %s on another backend', async (_label, during, record, outcome) => {
    STORE.setItem(multichainKeyMap.devBackend, LOCAL_BACKEND);
    saved({ inputs: null, forgotten: true });
    try {
      const env = setup({ scenario: FAKE_SCENARIO.EMPTY });
      await connect(env);
      devBackendFlag(env, true);
      await wait(2000);
      // The local backend never had it: no notice there, and a transfer goes.
      expect(env.getState().multichain.transfer).toMatchObject({
        status: OPERATION_STATUS.IDLE, errorCode: null,
      });
      const bridge = {
        transfer: jest.fn(async () => {
          if (during) {
            devBackendFlag(env, false);
            await new Promise((resolve) => { setTimeout(resolve, 3000); });
          }
          return record;
        }),
        resolveTransfer: jest.fn(),
        getTransfers: async () => [],
      };
      jest.spyOn(bridgeModule, 'createBridge').mockReturnValue(bridge);
      const request = (requestId) => multichainTransferRequested({
        amount: 500n, toAddress: ADDRESS, pinCode: PIN, requestId,
      });
      env.dispatch(request('screen-1'));
      await wait(1000);
      if (!during) {
        devBackendFlag(env, false);
      }
      await wait(4000);
      // Its screen still shows it as its own, and nothing else.
      expect(env.getState().multichain.transfer).toMatchObject({
        ...outcome, requestId: 'screen-1',
      });
      // Closed, the next transfer here hears of the forgotten one first.
      env.dispatch(multichainTransferReset());
      env.dispatch(request('screen-2'));
      await wait(1000);
      expect(bridge.transfer).toHaveBeenCalledTimes(1);
      expect(env.getState().multichain.transfer).toMatchObject({ ...FORGOTTEN, requestId: null });
    } finally {
      STORE.removeItem(multichainKeyMap.devBackend);
    }
  });

  test('one not confirmed yet whose screen closed holds no transfer on another backend', async () => {
    STORE.setItem(multichainKeyMap.devBackend, LOCAL_BACKEND);
    try {
      const env = setup({ scenario: FAKE_SCENARIO.EMPTY });
      await connect(env);
      devBackendFlag(env, true);
      await wait(2000);
      const bridge = {
        transfer: jest.fn(async () => {
          throw new NextClientError(NEXT_CLIENT_ERROR.TRANSFER_UNCERTAIN, { transferId: 'transfer-2' });
        }),
        resolveTransfer: jest.fn(async () => { throw new Error('unreachable'); }),
        getTransfers: async () => [],
      };
      jest.spyOn(bridgeModule, 'createBridge').mockReturnValue(bridge);
      env.dispatch(multichainTransferRequested({
        amount: 500n, toAddress: ADDRESS, pinCode: PIN, requestId: 'screen-1',
      }));
      await wait(1000);
      const unconfirmed = { status: OPERATION_STATUS.UNCONFIRMED, uncertainId: 'transfer-2' };
      // Its screen closes, and the transfer stays: it is still being decided.
      env.dispatch(multichainTransferReset());
      expect(env.getState().multichain.transfer).toMatchObject({
        ...unconfirmed, requestId: 'screen-1',
      });
      // The flag turns the local backend off: that transfer isn't this backend's, and holds
      // nothing here.
      devBackendFlag(env, false);
      await wait(2000);
      expect(env.getState().multichain.transfer).toMatchObject({
        status: OPERATION_STATUS.IDLE, uncertainId: null, requestId: null,
      });
      // Back on the local backend, it shows again.
      devBackendFlag(env, true);
      await wait(2000);
      expect(env.getState().multichain.transfer).toMatchObject({ ...unconfirmed, requestId: null });
    } finally {
      STORE.removeItem(multichainKeyMap.devBackend);
    }
  });

  test('one that never went through lets the next transfer go ahead at once', async () => {
    saved({ inputs: [{ txId: '01'.repeat(32), index: 1 }] });
    const env = setup({ scenario: FAKE_SCENARIO.EMPTY });
    await connect(env);
    const bridge = {
      transfer: jest.fn(async () => ({ id: 'transfer-2', status: TRANSFER_STATUS.PENDING })),
      resolveTransfer: jest.fn(async () => null),
      getTransfers: async () => [],
    };
    jest.spyOn(bridgeModule, 'createBridge').mockReturnValue(bridge);
    env.dispatch(multichainTransferRequested({ amount: 500n, toAddress: ADDRESS, pinCode: PIN }));
    await wait(1000);
    // Nothing left the wallet: the transfer asked for now is the one that goes.
    expect(bridge.transfer).toHaveBeenCalledTimes(1);
    expect(env.getState().multichain.transfer.status).toBe(OPERATION_STATUS.DONE);
  });

  test('stays with its network: another shows none, and it shows again back there', async () => {
    saved();
    const env = setup({ scenario: FAKE_SCENARIO.EMPTY });
    await wait(0);
    env.dispatch(setFullNodeNetworkName('testnet-other'));
    env.dispatch(startWalletSuccess());
    await wait(0);
    expect(env.getState().multichain.transfer).toMatchObject({
      status: OPERATION_STATUS.IDLE, uncertainId: null,
    });
    env.dispatch(setFullNodeNetworkName(NETWORK));
    env.dispatch(startWalletSuccess());
    await wait(0);
    expect(env.getState().multichain.transfer).toMatchObject({
      status: OPERATION_STATUS.UNCONFIRMED, uncertainId: 'transfer-1',
    });
  });

  test('is never taken from the confirm screen that sent it by a reload', async () => {
    const env = setup({ scenario: FAKE_SCENARIO.EMPTY });
    await wait(0);
    saved();
    env.dispatch(multichainTransferUpdate({
      status: OPERATION_STATUS.UNCONFIRMED, uncertainId: 'transfer-1', requestId: 'screen-1',
    }));
    env.dispatch(startWalletSuccess());
    await wait(0);
    expect(env.getState().multichain.transfer.requestId).toBe('screen-1');
  });
});

describe('a wallet reset', () => {
  test('clears the transfer state and the sign-once ledgers saved before outside the wallet\'s keys', async () => {
    STORE.setItem('multichain:nextSigned:1003:abcd', { entries: [] });
    STORE.setItem('multichain:nextSigned:1777:ef01', { entries: [] });
    const env = setup({ scenario: FAKE_SCENARIO.EMPTY });
    env.dispatch(multichainTransferUpdate({
      status: OPERATION_STATUS.UNCONFIRMED, uncertainId: 'transfer-1',
    }));
    env.dispatch(resetWallet());
    await wait(10);
    expect(STORE.getItem('multichain:nextSigned:1003:abcd')).toBeNull();
    expect(STORE.getItem('multichain:nextSigned:1777:ef01')).toBeNull();
    expect(env.getState().multichain.transfer).toMatchObject({
      status: OPERATION_STATUS.IDLE, uncertainId: null,
    });
  });
});

describe('the keys at an unlock on mainnet', () => {
  test('are still derived with the flag on, though Hathor Next stays off there', async () => {
    STORE.setItem(multichainKeyMap.next, { address: ADDRESS, registered: { [NETWORK]: true } });
    const env = setup({ networkSettings: PRE_SETTINGS_MAINNET, start: false });
    env.dispatch(multichainNextKeysUnlockRequested({ pinCode: PIN }));
    await wait(10);
    // Switching to a network with a side chain then needs no PIN.
    expect(getNextClient().hasKeys()).toBe(true);
    expect(isSideChainAvailable(env.getState())).toBe(false);
  });
});

describe('a load that fails for a reason the user can act on', () => {
  test.each([
    [NEXT_CLIENT_ERROR.NETWORK_CHANGED, /Update the app/],
    [NEXT_CLIENT_ERROR.CLOCK, /date and time/],
  ])('says so (%s)', async (code, words) => {
    STORE.setItem(multichainKeyMap.next, { address: ADDRESS, registered: { [NETWORK]: true } });
    STORE.setItem(multichainKeyMap.connectedNetworks, { [NETWORK]: true });
    const env = setup({ start: false });
    env.dispatch(multichainNextKeysUnlockRequested({ pinCode: PIN }));
    await wait(10);
    jest.spyOn(ensureNextClient(), 'connect').mockRejectedValue(new NextClientError(code));
    env.dispatch(startWalletSuccess());
    await wait(1000);
    expect(env.getState().multichain.next.status).toBe(NEXT_STATUS.FAILED);
    expect(env.getState().multichain.next.error).toMatch(words);
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
    // Saved under the network and its node: every privatenet reports the same name.
    expect(env.getState().multichain.connectedNetworks).toEqual({
      'privatenet https://legacy-node.devnet-alpha.samba.hathor.network/v1a': true,
    });
  });

  test('keeps the setting under the node: another privatenet reports the same name', async () => {
    const env = setup({
      network: 'privatenet',
      networkSettings: { ...PRE_SETTINGS_NEXT_DEVNET, nodeUrl: 'http://192.168.0.10:8080/v1a/' },
    });
    await wait(0);
    expect(selectSideChainKey(env.getState())).toBe('privatenet http://192.168.0.10:8080/v1a');
  });

  test("keeps a tester's setting saved under the network's name alone, under its node now", async () => {
    STORE.setItem(multichainKeyMap.connectedNetworks, { privatenet: true, testnet: true });
    const env = setup({ network: 'privatenet', networkSettings: PRE_SETTINGS_NEXT_DEVNET });
    await wait(0);
    const key = 'privatenet https://legacy-node.devnet-alpha.samba.hathor.network/v1a';
    expect(env.getState().multichain.connectedNetworks).toEqual({ [key]: true, testnet: true });
    expect(STORE.getItem(multichainKeyMap.connectedNetworks))
      .toEqual({ [key]: true, testnet: true });
    expect(isSideChainConnected(env.getState())).toBe(true);
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

  // A poll of Unleash that finds a change, as the feature-toggle saga makes it: the flags, and
  // "flags updated" right after.
  function* poll(toggles) {
    yield put(setFeatureToggles(toggles));
    yield put({ type: types.FEATURE_TOGGLE_UPDATED });
  }

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

  test('shows a transfer signed without an answer on the backend it was signed on, and only there', async () => {
    STORE.setItem(multichainKeyMap.devBackend, LOCAL);
    STORE.setItem(multichainKeyMap.uncertainTransfer, {
      id: 'transfer-1', network: NETWORK, backendUrl: null,
    });
    try {
      const env = setup({ scenario: FAKE_SCENARIO.EMPTY });
      await connect(env);
      expect(env.getState().multichain.transfer).toMatchObject({
        status: OPERATION_STATUS.UNCONFIRMED, uncertainId: 'transfer-1',
      });
      env.dispatch(setFeatureToggles({
        [MULTICHAIN_FEATURE_TOGGLE]: true, [MULTICHAIN_DEV_BACKEND_FEATURE_TOGGLE]: true,
      }));
      env.dispatch({ type: types.FEATURE_TOGGLE_UPDATED });
      await wait(2000);
      // The local backend never had it: a confirm screen there takes no other's for its own.
      expect(env.getState().multichain.transfer).toMatchObject({
        status: OPERATION_STATUS.IDLE, uncertainId: null,
      });
      env.dispatch(setFeatureToggles({ [MULTICHAIN_FEATURE_TOGGLE]: true }));
      env.dispatch({ type: types.FEATURE_TOGGLE_UPDATED });
      await wait(2000);
      expect(env.getState().multichain.transfer).toMatchObject({
        status: OPERATION_STATUS.UNCONFIRMED, uncertainId: 'transfer-1',
      });
    } finally {
      STORE.removeItem(multichainKeyMap.devBackend);
      STORE.removeItem(multichainKeyMap.uncertainTransfer);
    }
  });

  test('connects again on the right backend when it turns off while the local one connects', async () => {
    STORE.setItem(multichainKeyMap.devBackend, LOCAL);
    try {
      const env = setup();
      await connect(env);
      const client = getNextClient();
      // As the app's client: a disconnect while it connects stops that connect.
      let disconnects = 0;
      const disconnect = client.disconnect.bind(client);
      jest.spyOn(client, 'disconnect').mockImplementation(() => {
        disconnects += 1;
        disconnect();
      });
      const original = client.connect.bind(client);
      let answer = null;
      const connectSpy = jest.spyOn(client, 'connect').mockImplementationOnce(async (params) => {
        const before = disconnects;
        // The local backend answers slowly.
        await new Promise((resolve) => { answer = resolve; });
        if (disconnects !== before) {
          throw new NextClientError(NEXT_CLIENT_ERROR.NOT_CONNECTED);
        }
        return original(params);
      });
      devBackendFlag(env, true);
      await wait(10);
      expect(connectSpy).toHaveBeenLastCalledWith(expect.objectContaining({
        config: expect.objectContaining({ backendUrl: LOCAL.url }),
      }));
      // Turned off before it answered.
      devBackendFlag(env, false);
      await wait(10);
      answer();
      await wait(2000);
      expect(connectSpy).toHaveBeenLastCalledWith(expect.objectContaining({
        config: FAKE_SIDE_CHAIN,
      }));
      expect(env.getState().multichain.next.status).toBe(NEXT_STATUS.READY);
    } finally {
      STORE.removeItem(multichainKeyMap.devBackend);
    }
  });

  test('loads Hathor Next again after a poll switches backends, the transfer of each shown first', async () => {
    STORE.setItem(multichainKeyMap.devBackend, LOCAL);
    try {
      const env = setup({ scenario: FAKE_SCENARIO.EMPTY });
      await connect(env);
      const connectSpy = jest.spyOn(getNextClient(), 'connect');
      // A transfer signed without an answer on the local backend: the switch shows it first.
      STORE.setItem(multichainKeyMap.uncertainTransfer, {
        id: 'transfer-2', network: NETWORK, backendUrl: LOCAL.url,
      });
      runSaga(env.io, poll, {
        [MULTICHAIN_FEATURE_TOGGLE]: true, [MULTICHAIN_DEV_BACKEND_FEATURE_TOGGLE]: true,
      });
      await wait(2000);
      expect(env.getState().multichain.transfer).toMatchObject({
        status: OPERATION_STATUS.UNCONFIRMED, uncertainId: 'transfer-2',
      });
      expect(connectSpy).toHaveBeenLastCalledWith(expect.objectContaining({
        config: expect.objectContaining({ backendUrl: LOCAL.url }),
      }));
      expect(env.getState().multichain.next.status).toBe(NEXT_STATUS.READY);

      // And back, with one signed without an answer on the network's own backend.
      STORE.setItem(multichainKeyMap.uncertainTransfer, {
        id: 'transfer-3', network: NETWORK, backendUrl: null,
      });
      runSaga(env.io, poll, { [MULTICHAIN_FEATURE_TOGGLE]: true });
      await wait(2000);
      expect(env.getState().multichain.transfer).toMatchObject({
        status: OPERATION_STATUS.UNCONFIRMED, uncertainId: 'transfer-3',
      });
      expect(connectSpy).toHaveBeenLastCalledWith(
        expect.objectContaining({ config: FAKE_SIDE_CHAIN }),
      );
      expect(env.getState().multichain.next.status).toBe(NEXT_STATUS.READY);
    } finally {
      STORE.removeItem(multichainKeyMap.devBackend);
      STORE.removeItem(multichainKeyMap.uncertainTransfer);
    }
  });

  test('leaves Hathor Next alone when nothing about the backend changed', async () => {
    const env = setup();
    await connect(env);
    const connectSpy = jest.spyOn(getNextClient(), 'connect');
    // A poll that found another flag changed.
    runSaga(env.io, poll, { ...env.getState().featureToggles, 'another.rollout': true });
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

describe('mainnet', () => {
  test('never connects, signs or burns, whatever the flag and the network name say', async () => {
    const env = setup({ networkSettings: PRE_SETTINGS_MAINNET });
    env.dispatch(multichainConnectSettingChanged(true, { pinCode: PIN }));
    await wait(2000);
    expect(STORE.getWalletWords).not.toHaveBeenCalled();
    expect(env.getState().multichain.connectedNetworks).toEqual({});
    expect(env.getState().multichain.next.status).toBe(NEXT_STATUS.STOPPED);
  });

  test('does nothing when Unleash puts the flags, every multichain one on and then off', async () => {
    // Even with the side chain saved as connected, and the keys' address saved.
    STORE.setItem(multichainKeyMap.next, { address: ADDRESS, registered: { [NETWORK]: true } });
    STORE.setItem(multichainKeyMap.connectedNetworks, { [NETWORK]: true });
    const multichainFlags = (on) => Object.fromEntries(Object.keys(FEATURE_TOGGLE_DEFAULTS)
      .filter((name) => name.startsWith('multichain'))
      .map((name) => [name, on]));
    const env = setup({ networkSettings: PRE_SETTINGS_MAINNET });
    await wait(2000);
    const before = env.dispatched.length;
    env.dispatch(setFeatureToggles(multichainFlags(true)));
    env.dispatch(featureToggleInitialized());
    await wait(2000);
    env.dispatch(setFeatureToggles(multichainFlags(false)));
    await wait(2000);
    // The test's own actions, and nothing from the saga.
    expect(env.dispatched.slice(before).map((action) => action.type)).toEqual([
      types.SET_FEATURE_TOGGLES, types.FEATURE_TOGGLE_INITIALIZED, types.SET_FEATURE_TOGGLES,
    ]);
    expect(STORE.getWalletWords).not.toHaveBeenCalled();
    expect(env.getState().multichain.next.status).toBe(NEXT_STATUS.STOPPED);
    expect(getNextClient()).toBeNull();
  });

  test('ignores a payment or a transfer asked for anyway', async () => {
    const env = setup();
    await connect(env);
    const client = getNextClient();
    const sendSpy = jest.spyOn(client, 'send');
    // The settings now say mainnet: the flags are off for it, and nothing is signed.
    env.dispatch(networkSettingsUpdateState(PRE_SETTINGS_MAINNET));
    env.dispatch(multichainNextSendRequested({
      tokenId: HTR, to: deriveFakeNextAddress('someone'), amount: 1n, draftId: 'mainnet-draft',
    }));
    env.dispatch(multichainTransferRequested({ amount: 10000n, toAddress: ADDRESS, pinCode: PIN }));
    await wait(2000);
    expect(sendSpy).not.toHaveBeenCalled();
    expect(loadLedger(NETWORK).transfers).toHaveLength(0);
    // Refused out loud, so a confirm screen still open doesn't wait for an outcome.
    expect(env.getState().multichain.send).toMatchObject({
      status: OPERATION_STATUS.ERROR,
      draftId: 'mainnet-draft',
      error: "Couldn't connect to Hathor Next.",
    });
    expect(env.getState().multichain.transfer).toMatchObject({
      status: OPERATION_STATUS.ERROR,
      error: "Couldn't connect to Hathor Next.",
    });
  });
});

describe('a request where the side chain was turned off', () => {
  test('signs and burns nothing, and says so to the confirm screen still open', async () => {
    const env = setup();
    await connect(env);
    const sendSpy = jest.spyOn(getNextClient(), 'send');
    env.dispatch(multichainConnectSettingChanged(false));
    await wait(10);
    env.dispatch(multichainNextSendRequested({
      tokenId: HTR, to: deriveFakeNextAddress('someone'), amount: 1n, draftId: 'off-draft',
    }));
    env.dispatch(multichainTransferRequested({ amount: 10000n, toAddress: ADDRESS, pinCode: PIN }));
    await wait(2000);
    expect(sendSpy).not.toHaveBeenCalled();
    expect(loadLedger(NETWORK).transfers).toHaveLength(0);
    expect(env.getState().multichain.send).toMatchObject({
      status: OPERATION_STATUS.ERROR, draftId: 'off-draft',
    });
    expect(env.getState().multichain.transfer.status).toBe(OPERATION_STATUS.ERROR);
  });
});

describe('a wallet reload', () => {
  test('after a lock keeps Hathor Next, though the lock took the keys', async () => {
    const env = setup();
    await connect(env);
    const client = getNextClient();
    const connectSpy = jest.spyOn(client, 'connect');
    // A lock drops the keys and keeps the session; the reconnect reloads the wallet before the PIN.
    jest.spyOn(client, 'hasKeys').mockReturnValue(false);
    env.dispatch(startWalletSuccess());
    await wait(2000);
    expect(connectSpy).not.toHaveBeenCalled();
    expect(env.getState().multichain.next.status).toBe(NEXT_STATUS.READY);
  });

  test('keeps a Hathor Next already loaded on this network, with no new connect', async () => {
    const env = setup();
    await connect(env);
    const connectSpy = jest.spyOn(getNextClient(), 'connect');
    // wallet-lib reloads the wallet at every reconnect, and the reload ends with a wallet start.
    env.dispatch(startWalletSuccess());
    expect(env.getState().multichain.next.status).toBe(NEXT_STATUS.READY);
    await wait(2000);
    expect(connectSpy).not.toHaveBeenCalled();
    expect(env.getState().multichain.next.status).toBe(NEXT_STATUS.READY);
  });

  test('leaves "Connect to side chain" to finish turning on', async () => {
    const env = setup();
    env.dispatch(multichainConnectSettingChanged(true, { pinCode: PIN }));
    await wait(10);
    expect(env.getState().multichain.connect.status).toBe(CONNECT_STATUS.CONNECTING);
    expect(env.getState().multichain.next.status).toBe(NEXT_STATUS.CONNECTING);
    // A reconnect reloads the wallet while the setting turns on: it isn't saved yet.
    env.dispatch(startWalletSuccess());
    await wait(2000);
    const { multichain } = env.getState();
    expect(multichain.connectedNetworks).toEqual({ [NETWORK]: true });
    expect(multichain.connect.status).toBe(CONNECT_STATUS.IDLE);
    expect(multichain.next.status).toBe(NEXT_STATUS.READY);
  });

  test('stops a setting turning on when the flag went off at the start', async () => {
    const env = setup();
    env.dispatch(multichainConnectSettingChanged(true, { pinCode: PIN }));
    // Before Hathor Next itself starts connecting: the keys are still being derived.
    expect(env.getState().multichain.next.status).toBe(NEXT_STATUS.STOPPED);
    env.dispatch(setFeatureToggles({ [MULTICHAIN_FEATURE_TOGGLE]: false }));
    env.dispatch(startWalletSuccess());
    await wait(2000);
    const { multichain } = env.getState();
    expect(multichain.connectedNetworks).toEqual({});
    expect(multichain.next.status).toBe(NEXT_STATUS.STOPPED);
  });

  test('stops a Hathor Next still running when the side chain is off at the start', async () => {
    const env = setup();
    await connect(env);
    // The start's own read of the flags turns them off: no "flags updated" action comes.
    env.dispatch(setFeatureToggles({ [MULTICHAIN_FEATURE_TOGGLE]: false }));
    env.dispatch(startWalletSuccess());
    await wait(10);
    expect(env.getState().multichain.next.status).toBe(NEXT_STATUS.STOPPED);
    expect(getNextClient().getNetwork()).toBeNull();
  });
});

describe('a connect of Hathor Next', () => {
  test('hands the follower what the client said while it connected', async () => {
    const env = setup();
    await connect(env);
    env.dispatch(multichainConnectSettingChanged(false));
    await wait(10);
    const client = getNextClient();
    // What subscribes to the client's events, and when.
    const listeners = [];
    const on = client.on.bind(client);
    jest.spyOn(client, 'on').mockImplementation((event, listener) => {
      listeners.push({ event, listener });
      return on(event, listener);
    });
    // A payment on its way; the connect learns it was recorded (the statement lists it now).
    env.dispatch(multichainNextSendUpdate({
      status: OPERATION_STATUS.SENDING, draftId: 'draft-1', sendId: 'send-1',
    }));
    const connectOnce = client.connect.bind(client);
    jest.spyOn(client, 'connect').mockImplementation(async (params) => {
      await connectOnce(params);
      listeners.filter((l) => l.event === NEXT_CLIENT_EVENT.SEND).forEach((l) => l.listener({
        sendId: 'send-1', status: 'recorded', reason: null, txId: 'aa'.repeat(32),
      }));
    });
    await connect(env);
    expect(env.getState().multichain.send).toMatchObject({ sendId: 'send-1', status: 'recorded' });
  });
});

describe('a load of Hathor Next', () => {
  test('is not cancelled by the next action of the handler that started it', async () => {
    STORE.setItem(multichainKeyMap.next, { address: ADDRESS, registered: { [NETWORK]: true } });
    STORE.setItem(multichainKeyMap.connectedNetworks, { [NETWORK]: true });
    // The unlock derives the keys with the flag on; it is off by the time the wallet starts.
    const env = setup({ start: false });
    env.dispatch(multichainNextKeysUnlockRequested({ pinCode: PIN }));
    await wait(10);
    env.dispatch(setFeatureToggles({ [MULTICHAIN_FEATURE_TOGGLE]: false }));
    env.dispatch(startWalletSuccess());
    await wait(10);
    expect(env.getState().multichain.next.status).toBe(NEXT_STATUS.STOPPED);
    // The flag comes on: the flags' handler loads Hathor Next.
    env.dispatch(setFeatureToggles({ [MULTICHAIN_FEATURE_TOGGLE]: true }));
    await wait(100);
    expect(env.getState().multichain.next.status).toBe(NEXT_STATUS.CONNECTING);
    // The flags are set again while the load runs: the handler is takeLatest.
    env.dispatch(setFeatureToggles({ [MULTICHAIN_FEATURE_TOGGLE]: true }));
    await wait(3000);
    expect(env.getState().multichain.next.status).toBe(NEXT_STATUS.READY);
  });
});

describe('a Hathor Next payment, without an outcome', () => {
  const draft = (draftId) => multichainNextSendRequested({
    tokenId: HTR, to: deriveFakeNextAddress('someone'), amount: 100000000n, draftId,
  });

  test('is shown as not settled yet after a while, so the user can leave', async () => {
    const env = setup();
    await connect(env);
    // Signed and handed over, and then nothing: Hathor Next lost track of it.
    jest.spyOn(getNextClient(), 'send').mockResolvedValue({ sendId: 'lost' });
    env.dispatch(draft('draft-lost'));
    await wait(SEND_SETTLE_MS - 1000);
    expect(env.getState().multichain.send.status).toBe(OPERATION_STATUS.SENDING);
    await wait(2000);
    expect(env.getState().multichain.send).toMatchObject({
      status: OPERATION_STATUS.UNCONFIRMED,
      sendId: 'lost',
    });
  });

  // The wallet still submits it again now and then, and the backend says submitted each time.
  test.each([
    ['after the wait', null],
    ['from the client', 'unconfirmed'],
  ])('shown as not settled yet %s, stays so while it goes out again, until it settles', async (_, told) => {
    const env = setup();
    const client = ensureNextClient();
    const listeners = [];
    const on = client.on.bind(client);
    jest.spyOn(client, 'on').mockImplementation((event, listener) => {
      listeners.push({ event, listener });
      return on(event, listener);
    });
    await connect(env);
    const tell = (status) => listeners
      .filter((l) => l.event === NEXT_CLIENT_EVENT.SEND)
      .forEach((l) => l.listener({ sendId: 'held', status, reason: null, txId: 'aa'.repeat(32) }));
    jest.spyOn(client, 'send').mockResolvedValue({ sendId: 'held' });
    env.dispatch(draft('draft-held'));
    await wait(1000);
    tell('pending');
    await wait(10);
    if (told) {
      tell(told);
      await wait(10);
    } else {
      await wait(SEND_SETTLE_MS);
    }
    expect(env.getState().multichain.send.status).toBe(OPERATION_STATUS.UNCONFIRMED);
    tell('pending');
    await wait(10);
    // Not on its way again: its screen lets the user leave.
    expect(env.getState().multichain.send.status).toBe(OPERATION_STATUS.UNCONFIRMED);
    expect(SEND_IN_FLIGHT).not.toContain(env.getState().multichain.send.status);
    tell('recorded');
    await wait(10);
    expect(env.getState().multichain.send).toMatchObject({
      status: OPERATION_STATUS.RECORDED, sendId: 'held',
    });
  });

  test('is never sent twice, even once its state was cleared', async () => {
    const env = setup();
    await connect(env);
    const sendSpy = jest.spyOn(getNextClient(), 'send');
    env.dispatch(draft('draft-once'));
    await wait(1000);
    // The confirm screen closed and cleared the payment, but stayed mounted.
    env.dispatch(multichainNextSendReset());
    env.dispatch(draft('draft-once'));
    await wait(1000);
    expect(sendSpy).toHaveBeenCalledTimes(1);
  });

  test('refused for a reason without words of its own shows translated words', async () => {
    const env = setup();
    await connect(env);
    jest.spyOn(getNextClient(), 'send').mockRejectedValue(new TypeError('Cannot read properties of null'));
    env.dispatch(draft('draft-bug'));
    await wait(1000);
    expect(env.getState().multichain.send).toMatchObject({
      status: OPERATION_STATUS.ERROR,
      error: 'Something went wrong on Hathor Next.',
    });
  });
});

// Every bridge the saga makes from now on is the fake one, changed by `change`.
function withBridge(change) {
  const mocked = jest.requireMock('../../src/multichain/bridge');
  const original = mocked.createBridge;
  jest.spyOn(mocked, 'createBridge')
    .mockImplementation((config, options) => change(original(config, options)));
}

describe('a transfer that went through', () => {
  test('stays done when reading the list of transfers again fails', async () => {
    const env = setup({ scenario: FAKE_SCENARIO.EMPTY });
    await connect(env);
    withBridge((bridge) => ({ ...bridge, getTransfers: () => Promise.reject(new Error('timeout')) }));
    env.dispatch(multichainTransferRequested({ amount: 10000n, toAddress: ADDRESS, pinCode: PIN }));
    await wait(1000);
    expect(env.getState().multichain.transfer).toMatchObject({
      status: OPERATION_STATUS.DONE,
      error: null,
    });
  });

  test('refused for a reason without words of its own shows translated words', async () => {
    const env = setup({ scenario: FAKE_SCENARIO.EMPTY });
    await connect(env);
    withBridge((bridge) => ({
      ...bridge,
      transfer: () => Promise.reject(new Error('Network request failed')),
    }));
    env.dispatch(multichainTransferRequested({ amount: 10000n, toAddress: ADDRESS, pinCode: PIN }));
    await wait(1000);
    expect(env.getState().multichain.transfer).toMatchObject({
      status: OPERATION_STATUS.ERROR,
      error: 'The transfer failed.',
    });
  });
});
