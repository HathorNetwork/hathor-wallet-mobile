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
import { errors } from '@hathor/wallet-lib';
import { CAPABILITY_REFRESH_DELAY_MS, saga } from '../../src/sagas/shielded';
import { WALLET_STATUS } from '../../src/sagas/wallet';
import { reducer } from '../../src/reducers/reducer';
import {
  sharedAddressUpdate,
  shieldedCapabilityUpdate,
  shieldedReceiveAddressUpdate,
  startWalletSuccess,
  types,
  walletRefreshSharedAddress,
} from '../../src/actions';
import {
  FEATURE_TOGGLE_DEFAULTS,
  FULL_NETWORK_SHIELDED_TESTNET,
  SHIELDED_OUTPUTS_FEATURE_TOGGLE,
  SHIELDED_PROVIDER_STATUS,
} from '../../src/constants';
import {
  SHIELDED_RECEIVE_INITIAL_STATE,
  SHIELDED_RECEIVE_STATUS,
} from '../../src/shielded/receiveState';
import { logger } from '../../src/logger';
/* eslint-enable import/first */

const log = logger();
const { LOADING, LOCKED, READY, UNAVAILABLE } = SHIELDED_RECEIVE_STATUS;
const ADDRESS = 'SHIELDED_ADDRESS_3';
const OTHER_ADDRESS = 'SHIELDED_ADDRESS_4';
const LEGACY_ADDRESS = 'LEGACY_ADDRESS_0';
const FLAG_OFF = { ...FEATURE_TOGGLE_DEFAULTS, [SHIELDED_OUTPUTS_FEATURE_TOGGLE]: false };
const FLAG_ON = { ...FEATURE_TOGGLE_DEFAULTS, [SHIELDED_OUTPUTS_FEATURE_TOGGLE]: true };

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
const FULL = capability();
const LOCKED_CAPABILITY = capability({
  level: 'watch',
  reason: 'locked',
  cause: 'wrong-pin',
  canReceive: false,
  canSpend: false,
  undecoded: { txIds: ['tx1'], locked: 1 },
});

const receive = (status, { address = null, index = null, reason = null } = {}) => ({
  status, address, index, reason,
});
const READY_RECEIVE = receive(READY, { address: ADDRESS, index: 3 });

/**
 * Runs the shielded saga over the state of a seed wallet running on the shielded testnet, with
 * the shielded UI flag on and the crypto provider ready. The shielded slice and the shared
 * address change as the reducer changes them, for the actions the saga puts and the ones a test
 * delivers. The shared address starts as the given one, the legacy address by default.
 */
function setup({
  start = FULL,
  startReceive = SHIELDED_RECEIVE_INITIAL_STATE,
  startShared = { address: LEGACY_ADDRESS, index: 0 },
  change = {},
} = {}) {
  const wallet = {
    isReady: jest.fn(() => true),
    getShieldedCapability: jest.fn(async () => state.shielded.capability),
    getCurrentAddress: jest.fn(async () => ({ address: ADDRESS, index: 3, addressPath: "m/44'/280'/1'/0/3" })),
  };
  let state = {
    wallet,
    walletStartState: WALLET_STATUS.READY,
    useWalletService: false,
    fullNodeNetworkName: FULL_NETWORK_SHIELDED_TESTNET,
    featureToggles: FLAG_ON,
    tokens: {},
    lastSharedAddress: startShared.address,
    lastSharedIndex: startShared.index,
    shielded: {
      providerStatus: SHIELDED_PROVIDER_STATUS.READY,
      providerError: null,
      capability: start,
      receive: startReceive,
    },
    ...change,
  };
  const reduceWritten = (action) => {
    if (action.type.startsWith('SHIELDED_') || action.type === types.SHARED_ADDRESS_UPDATE) {
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
        reduceWritten(action);
      },
      getState: () => state,
    },
    saga,
  );
  const deliver = (action) => {
    reduceWritten(action);
    channel.put(action);
  };
  const ofType = (type) => () => dispatched.filter((action) => action.type === type);
  // The start loaded the balances with the start capability.
  deliver(startWalletSuccess());
  return {
    wallet,
    deliver,
    receiveUpdates: ofType(types.SHIELDED_RECEIVE_ADDRESS_UPDATE),
    sharedUpdates: ofType(types.SHARED_ADDRESS_UPDATE),
    refreshRequests: ofType(types.WALLET_REFRESH_SHARED_ADDRESS),
    getState: () => state,
    setState: (next) => { state = { ...state, ...next }; },
  };
}

const wait = (ms) => jest.advanceTimersByTimeAsync(ms);

describe('the private receive state', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  test('reads the current shielded address of a wallet that can receive privately', async () => {
    const { wallet, deliver, receiveUpdates, getState } = setup();

    deliver(walletRefreshSharedAddress());
    await wait(0);

    expect(wallet.getCurrentAddress).toHaveBeenCalledWith({}, { legacy: false });
    expect(receiveUpdates()).toEqual([shieldedReceiveAddressUpdate(READY_RECEIVE)]);
    expect(getState().shielded.receive).toEqual(READY_RECEIVE);
  });

  test.each([
    ['a wallet locked by a stale PIN', LOCKED_CAPABILITY, receive(LOCKED, { reason: 'wrong-pin' })],
    ['a wallet with no crypto provider', capability({ level: 'none', reason: 'no-provider', canReceive: false }), receive(UNAVAILABLE, { reason: 'no-provider' })],
    ['a wallet that has not started', capability({ level: 'none', reason: 'not-started', canReceive: false }), receive(LOADING)],
    ['a wallet whose scan key is corrupt', { ...LOCKED_CAPABILITY, cause: 'corrupt-key' }, receive(UNAVAILABLE, { reason: 'corrupt-key' })],
  ])('reads no address for %s', async (_label, current, expected) => {
    const { wallet, deliver, receiveUpdates } = setup({ start: current });

    deliver(walletRefreshSharedAddress());
    await wait(0);

    expect(wallet.getCurrentAddress).not.toHaveBeenCalled();
    expect(receiveUpdates()).toEqual([shieldedReceiveAddressUpdate(expected)]);
  });

  test('reads the current shielded address of a wallet-service facade wallet, which has no getShieldedCapability', async () => {
    const { wallet, deliver, receiveUpdates } = setup({ change: { useWalletService: true } });
    delete wallet.getShieldedCapability;
    wallet.isShieldedEnabled = jest.fn(() => true);
    wallet.storage = { shieldedCryptoProvider: {} };

    deliver(walletRefreshSharedAddress());
    await wait(0);

    expect(wallet.getCurrentAddress).toHaveBeenCalledWith({}, { legacy: false });
    expect(receiveUpdates()).toEqual([shieldedReceiveAddressUpdate(READY_RECEIVE)]);
  });

  test('reads no address of a wallet-service facade wallet whose shielded keys the service did not register', async () => {
    const { wallet, deliver, receiveUpdates } = setup({ change: { useWalletService: true } });
    delete wallet.getShieldedCapability;
    wallet.isShieldedEnabled = jest.fn(() => false);
    wallet.storage = { shieldedCryptoProvider: {} };

    deliver(walletRefreshSharedAddress());
    await wait(0);

    expect(wallet.getCurrentAddress).not.toHaveBeenCalled();
    expect(receiveUpdates()).toEqual([
      shieldedReceiveAddressUpdate(receive(UNAVAILABLE, { reason: 'no-shielded-keys' })),
    ]);
  });

  test.each([
    ['the scan key locked meanwhile', new errors.ShieldedKeyError('shielded-locked', 'locked'), receive(LOCKED)],
    ['no crypto provider', new errors.ShieldedKeyError('shielded-no-provider', 'no provider'), receive(UNAVAILABLE, { reason: 'shielded-no-provider' })],
    ['the shielded addresses not loaded yet', new Error('Current shielded address is not loaded (index=0). Derive at least one shielded address before calling getCurrentAddress.'), receive(LOADING)],
    ['no unused shielded address from the wallet-service', new errors.WalletError('The wallet-service has no unused shielded address for this wallet.'), receive(UNAVAILABLE, { reason: 'error' })],
    ['single-address mode on the wallet-service facade', new errors.WalletError('Shielded addresses are not supported in single-address mode.'), receive(UNAVAILABLE, { reason: 'single-address' })],
  ])('maps a refusal for %s', async (_label, error, expected) => {
    const { wallet, deliver, receiveUpdates } = setup();
    wallet.getCurrentAddress.mockRejectedValue(error);

    deliver(walletRefreshSharedAddress());
    await wait(0);

    expect(receiveUpdates()).toEqual([shieldedReceiveAddressUpdate(expected)]);
    expect(log.error).not.toHaveBeenCalled();
  });

  test('logs an error it does not expect, and shows the address as unavailable', async () => {
    const { wallet, deliver, receiveUpdates } = setup();
    wallet.getShieldedCapability.mockRejectedValue(new Error('storage closed'));

    deliver(walletRefreshSharedAddress());
    await wait(0);

    expect(log.error).toHaveBeenCalledTimes(1);
    expect(receiveUpdates()).toEqual([
      shieldedReceiveAddressUpdate(receive(UNAVAILABLE, { reason: 'error' })),
    ]);
  });

  test.each([
    ['the shielded UI flag is off', {
      featureToggles: { ...FEATURE_TOGGLE_DEFAULTS, [SHIELDED_OUTPUTS_FEATURE_TOGGLE]: false },
    }],
    ['the node reports another network', { fullNodeNetworkName: 'testnet-india' }],
    ['no provider was tried for the wallet', {
      shielded: {
        providerStatus: SHIELDED_PROVIDER_STATUS.UNREGISTERED,
        providerError: null,
        capability: null,
        receive: SHIELDED_RECEIVE_INITIAL_STATE,
      },
    }],
  ])('reads nothing from the wallet, and leaves the shared address alone, while %s', async (_label, change) => {
    const { wallet, deliver, receiveUpdates, sharedUpdates } = setup({ change });

    deliver(walletRefreshSharedAddress());
    await wait(0);

    expect(wallet.getShieldedCapability).not.toHaveBeenCalled();
    expect(wallet.getCurrentAddress).not.toHaveBeenCalled();
    expect(receiveUpdates()).toEqual([]);
    expect(sharedUpdates()).toEqual([]);
  });

  test('goes back to idle, reading nothing, when the shielded UI turns off', async () => {
    const { wallet, deliver, receiveUpdates, setState } = setup({ startReceive: READY_RECEIVE });
    setState({
      featureToggles: { ...FEATURE_TOGGLE_DEFAULTS, [SHIELDED_OUTPUTS_FEATURE_TOGGLE]: false },
    });

    deliver(walletRefreshSharedAddress());
    await wait(0);

    expect(wallet.getShieldedCapability).not.toHaveBeenCalled();
    expect(receiveUpdates()).toEqual([
      shieldedReceiveAddressUpdate(SHIELDED_RECEIVE_INITIAL_STATE),
    ]);
  });

  test('puts nothing when the state is the same', async () => {
    const { deliver, receiveUpdates, sharedUpdates } = setup({
      startReceive: READY_RECEIVE,
      startShared: { address: ADDRESS, index: 3 },
    });

    deliver(walletRefreshSharedAddress());
    await wait(0);

    expect(receiveUpdates()).toEqual([]);
    expect(sharedUpdates()).toEqual([]);
  });

  test('reads the state again once a capability change settles', async () => {
    const { wallet, deliver, receiveUpdates, getState } = setup({
      start: LOCKED_CAPABILITY,
      startReceive: receive(LOCKED, { reason: 'wrong-pin' }),
    });

    deliver(shieldedCapabilityUpdate(FULL));
    await wait(CAPABILITY_REFRESH_DELAY_MS - 1);
    expect(wallet.getShieldedCapability).not.toHaveBeenCalled();
    await wait(1);

    expect(receiveUpdates()).toEqual([shieldedReceiveAddressUpdate(READY_RECEIVE)]);
    expect(getState().shielded.receive).toEqual(READY_RECEIVE);
  });

  test('reads it once for a burst of capability changes', async () => {
    const { wallet, deliver } = setup({ start: LOCKED_CAPABILITY });

    deliver(shieldedCapabilityUpdate({ ...LOCKED_CAPABILITY, cause: 'error' }));
    await wait(100);
    deliver(shieldedCapabilityUpdate(FULL));
    await wait(CAPABILITY_REFRESH_DELAY_MS);

    expect(wallet.getShieldedCapability).toHaveBeenCalledTimes(1);
  });

  test('keeps what a later refresh read when an earlier one ends last', async () => {
    const { wallet, deliver, receiveUpdates, getState } = setup();
    let finishEarlier;
    wallet.getCurrentAddress
      .mockImplementationOnce(() => new Promise((resolve) => { finishEarlier = resolve; }))
      .mockImplementationOnce(async () => ({ address: OTHER_ADDRESS, index: 4 }));

    deliver(walletRefreshSharedAddress());
    await wait(0);
    deliver(walletRefreshSharedAddress());
    await wait(0);
    finishEarlier({ address: ADDRESS, index: 3 });
    await wait(0);

    const later = receive(READY, { address: OTHER_ADDRESS, index: 4 });
    expect(receiveUpdates()).toEqual([shieldedReceiveAddressUpdate(later)]);
    expect(getState().shielded.receive).toEqual(later);
    expect(getState().lastSharedAddress).toBe(OTHER_ADDRESS);
  });

  test('drops what it read for a wallet the app has replaced', async () => {
    const { wallet, deliver, receiveUpdates, sharedUpdates, setState } = setup();
    let finish;
    wallet.getCurrentAddress.mockImplementationOnce(
      () => new Promise((resolve) => { finish = resolve; }),
    );

    deliver(walletRefreshSharedAddress());
    await wait(0);
    setState({ wallet: { isReady: () => true } });
    finish({ address: ADDRESS, index: 3 });
    await wait(0);

    expect(receiveUpdates()).toEqual([]);
    expect(sharedUpdates()).toEqual([]);
  });
});

describe('the shared address in the shielded environment', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  test('is the current shielded address', async () => {
    const { deliver, sharedUpdates, getState } = setup();

    deliver(walletRefreshSharedAddress());
    await wait(0);

    expect(sharedUpdates()).toEqual([sharedAddressUpdate(ADDRESS, 3)]);
    expect(getState().lastSharedAddress).toBe(ADDRESS);
    expect(getState().lastSharedIndex).toBe(3);
  });

  test.each([
    ['locked', LOCKED_CAPABILITY],
    ['unavailable', capability({ level: 'none', reason: 'no-provider', canReceive: false })],
    ['loading', capability({ level: 'none', reason: 'not-started', canReceive: false })],
  ])('is none while the shielded address is %s, never the legacy one', async (_label, current) => {
    const { deliver, sharedUpdates, getState } = setup({ start: current });

    deliver(walletRefreshSharedAddress());
    await wait(0);

    expect(sharedUpdates()).toEqual([sharedAddressUpdate(null, null)]);
    expect(getState().lastSharedAddress).toBeNull();
  });

  test('is none when the shielded address could not be read', async () => {
    const { wallet, deliver, sharedUpdates } = setup();
    wallet.getCurrentAddress.mockRejectedValue(new Error('storage closed'));

    deliver(walletRefreshSharedAddress());
    await wait(0);

    expect(sharedUpdates()).toEqual([sharedAddressUpdate(null, null)]);
  });

  test('is put again when it is not the address the receive state holds', async () => {
    const { deliver, receiveUpdates, sharedUpdates } = setup({ startReceive: READY_RECEIVE });

    deliver(walletRefreshSharedAddress());
    await wait(0);

    expect(receiveUpdates()).toEqual([]);
    expect(sharedUpdates()).toEqual([sharedAddressUpdate(ADDRESS, 3)]);
  });

  test('is left to the legacy refresh while the shielded UI is off', async () => {
    const { deliver, sharedUpdates, getState } = setup({
      startReceive: READY_RECEIVE,
      change: { featureToggles: FLAG_OFF },
    });

    deliver(walletRefreshSharedAddress());
    await wait(0);

    expect(sharedUpdates()).toEqual([]);
    expect(getState().lastSharedAddress).toBe(LEGACY_ADDRESS);
  });
});

describe('a change of the shielded UI flag', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  const toggleUpdated = { type: types.FEATURE_TOGGLE_UPDATED };

  test('reads the shared address again when the shielded UI turns on', async () => {
    const { deliver, refreshRequests, setState } = setup({ change: { featureToggles: FLAG_OFF } });

    setState({ featureToggles: FLAG_ON });
    deliver(toggleUpdated);
    await wait(0);

    expect(refreshRequests()).toEqual([walletRefreshSharedAddress()]);
  });

  test('reads the shared address again when the shielded UI turns off', async () => {
    const { deliver, refreshRequests, setState } = setup({
      startReceive: READY_RECEIVE,
      startShared: { address: ADDRESS, index: 3 },
    });

    setState({ featureToggles: FLAG_OFF });
    deliver(toggleUpdated);
    await wait(0);

    expect(refreshRequests()).toEqual([walletRefreshSharedAddress()]);
  });

  test.each([
    ['on', FLAG_ON, READY_RECEIVE],
    ['off', FLAG_OFF, SHIELDED_RECEIVE_INITIAL_STATE],
  ])('reads nothing when the shielded UI stays %s', async (_label, featureToggles, startReceive) => {
    const { deliver, refreshRequests } = setup({ startReceive, change: { featureToggles } });

    deliver(toggleUpdated);
    await wait(0);

    expect(refreshRequests()).toEqual([]);
  });

  test('reads nothing while the wallet starts: its start reads the shared address', async () => {
    const { deliver, refreshRequests, setState } = setup({
      change: { featureToggles: FLAG_OFF, walletStartState: WALLET_STATUS.LOADING },
    });

    setState({ featureToggles: FLAG_ON });
    deliver(toggleUpdated);
    await wait(0);

    expect(refreshRequests()).toEqual([]);
  });
});
