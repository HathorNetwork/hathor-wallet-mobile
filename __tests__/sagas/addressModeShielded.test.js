/**
 * Copyright (c) Hathor Labs and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { jest, describe, test, expect, afterEach, beforeEach } from '@jest/globals';

// HathorWallet stands in for the fullnode-facade wallet: it keeps the config it was built with,
// its start() reports the network the test gives, and its storage reports the scan policy the
// config asked for.
jest.mock('@hathor/wallet-lib', () => {
  const actual = jest.requireActual('@hathor/wallet-lib');
  const { EventEmitter } = jest.requireActual('events');

  class MockHathorWallet extends EventEmitter {
    constructor(config = {}) {
      super();
      this.config = config;
      this.storage = {
        ...config.storage,
        getScanningPolicy: async () => config.scanPolicy.policy,
      };
      this.conn = new EventEmitter();
      MockHathorWallet.instances.push(this);
    }

    // eslint-disable-next-line class-methods-use-this
    setHistorySyncMode() {}

    // eslint-disable-next-line class-methods-use-this
    setShieldedCryptoProvider() {}

    // eslint-disable-next-line class-methods-use-this
    setExternalTxSigningMethod() {}

    // eslint-disable-next-line class-methods-use-this
    start() {
      return Promise.resolve({ network: MockHathorWallet.networkName });
    }

    // eslint-disable-next-line class-methods-use-this
    getShieldedCapability() {
      return Promise.resolve(null);
    }

    // eslint-disable-next-line class-methods-use-this
    isReady() {
      return true;
    }
  }
  MockHathorWallet.instances = [];
  MockHathorWallet.networkName = null;

  class MockConnection extends EventEmitter {}

  return { ...actual, HathorWallet: MockHathorWallet, Connection: MockConnection };
});

jest.mock('../../src/sagas/shieldedProvider', () => ({
  registerShieldedCryptoProvider: jest.fn(),
}));

// startWallet refreshes the Unleash client; these tests set the toggles in the state instead.
jest.mock('../../src/sagas/featureToggle', () => ({
  ...jest.requireActual('../../src/sagas/featureToggle'),
  monitorFeatureFlags: jest.fn(),
}));

/* eslint-disable import/first */
import { runSaga, stdChannel } from 'redux-saga';
import { HathorWallet, SCANNING_POLICY } from '@hathor/wallet-lib';
import { decideAddressMode, startWallet } from '../../src/sagas/wallet';
import { setAddressMode, startWalletRequested, types } from '../../src/actions';
import {
  ADDRESS_MODE,
  FEATURE_TOGGLE_DEFAULTS,
  FULL_NETWORK_SHIELDED_TESTNET,
  PRE_SETTINGS_SHIELDED_TESTNET,
  PRE_SETTINGS_TESTNET,
  SINGLE_ADDRESS_FEATURE_TOGGLE,
  addressModeKey,
  networkSettingsKeyMap,
} from '../../src/constants';
import { STORE } from '../../src/store';
/* eslint-enable import/first */

describe('decideAddressMode', () => {
  test.each([
    [false, null],
    [true, null],
    [true, ADDRESS_MODE.SINGLE],
    [true, ADDRESS_MODE.MULTI],
  ])('keeps a wallet with a shielded chain in multi-address mode (single-address flag %s, stored %s)', (singleAddressFeatureEnabled, storedAddressMode) => {
    expect(decideAddressMode({
      singleAddressFeatureEnabled,
      storedAddressMode,
      shieldedChainActive: true,
    })).toBe(ADDRESS_MODE.MULTI);
  });

  test.each([
    [false, null, ADDRESS_MODE.MULTI],
    [false, ADDRESS_MODE.SINGLE, ADDRESS_MODE.MULTI],
    [true, null, ADDRESS_MODE.SINGLE],
    [true, ADDRESS_MODE.SINGLE, ADDRESS_MODE.SINGLE],
    [true, ADDRESS_MODE.MULTI, ADDRESS_MODE.MULTI],
  ])('decides as before without a shielded chain (single-address flag %s, stored %s)', (singleAddressFeatureEnabled, storedAddressMode, expected) => {
    expect(decideAddressMode({
      singleAddressFeatureEnabled,
      storedAddressMode,
      shieldedChainActive: false,
    })).toBe(expected);
    expect(decideAddressMode({ singleAddressFeatureEnabled, storedAddressMode })).toBe(expected);
  });
});

const WORDS = 'seed words';
const PIN = '111111';

/**
 * Runs startWallet for a seed wallet, with the single-address flag on and SINGLE stored for the
 * network, until it loads the tokens, then cancels it. It returns the wallet it built, what it
 * dispatched, and the address-mode writes it made to the store.
 */
async function runStart({ networkSettings, nodeNetwork, walletMeta = null }) {
  HathorWallet.networkName = nodeNetwork;
  jest.spyOn(STORE, 'getWalletMeta').mockReturnValue(walletMeta);
  jest.spyOn(STORE, 'getStorage').mockReturnValue({
    store: { cleanMetadata: jest.fn() },
    cleanStorage: jest.fn(),
  });
  jest.spyOn(STORE, 'getItem').mockImplementation((key) => {
    if (key === networkSettingsKeyMap.networkSettings) return networkSettings;
    if (key === addressModeKey(networkSettings.network)) return ADDRESS_MODE.SINGLE;
    return null;
  });
  const setItem = jest.spyOn(STORE, 'setItem').mockImplementation(() => {});
  const state = {
    featureTogglesInitialized: true,
    featureToggles: { ...FEATURE_TOGGLE_DEFAULTS, [SINGLE_ADDRESS_FEATURE_TOGGLE]: true },
    networkSettings,
  };

  let reached;
  const loadingTokens = new Promise((resolve) => { reached = resolve; });
  const dispatched = [];
  const task = runSaga(
    {
      channel: stdChannel(),
      dispatch: (action) => {
        if (!action?.type) return;
        dispatched.push(action);
        if (action.type === types.TOKEN_FETCH_BALANCE_REQUESTED) reached();
      },
      getState: () => state,
    },
    startWallet,
    startWalletRequested({ words: WORDS, pin: PIN }),
  );
  const ended = task.toPromise().then(() => {
    throw new Error('startWallet ended before it loaded the tokens');
  });
  await Promise.race([loadingTokens, ended]);
  task.cancel();

  const wallet = HathorWallet.instances[HathorWallet.instances.length - 1];
  const addressModeWrites = setItem.mock.calls.filter(
    ([key]) => key === addressModeKey(networkSettings.network),
  );
  return { wallet, dispatched, addressModeWrites };
}

describe('startWallet and the address mode', () => {
  beforeEach(() => {
    HathorWallet.instances = [];
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('starts a seed wallet on the shielded testnet in multi-address mode, and keeps it out of the store', async () => {
    const { wallet, dispatched, addressModeWrites } = await runStart({
      networkSettings: PRE_SETTINGS_SHIELDED_TESTNET,
      nodeNetwork: FULL_NETWORK_SHIELDED_TESTNET,
    });

    expect(wallet.config.scanPolicy.policy).toBe(SCANNING_POLICY.GAP_LIMIT);
    expect(dispatched).toContainEqual(setAddressMode(ADDRESS_MODE.MULTI));
    expect(addressModeWrites).toEqual([]);
  });

  test('still starts a seed wallet on the public testnet in the stored single-address mode', async () => {
    const { wallet, dispatched, addressModeWrites } = await runStart({
      networkSettings: PRE_SETTINGS_TESTNET,
      nodeNetwork: 'testnet-india',
    });

    expect(wallet.config.scanPolicy.policy).toBe(SCANNING_POLICY.SINGLE_ADDRESS);
    expect(dispatched).toContainEqual(setAddressMode(ADDRESS_MODE.SINGLE));
    expect(addressModeWrites).toEqual([[addressModeKey('testnet'), ADDRESS_MODE.SINGLE]]);
  });

  test('leaves a passkey wallet on the shielded testnet, which gets no shielded chain, as before', async () => {
    const { wallet, addressModeWrites } = await runStart({
      networkSettings: PRE_SETTINGS_SHIELDED_TESTNET,
      nodeNetwork: FULL_NETWORK_SHIELDED_TESTNET,
      walletMeta: { walletType: 'passkey', xpub: 'xpub-passkey-wallet' },
    });

    expect(wallet.config.scanPolicy.policy).toBe(SCANNING_POLICY.SINGLE_ADDRESS);
    expect(addressModeWrites).toEqual([[addressModeKey('testnet'), ADDRESS_MODE.SINGLE]]);
  });
});
