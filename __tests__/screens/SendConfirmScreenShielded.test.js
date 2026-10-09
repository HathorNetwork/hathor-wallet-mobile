/**
 * Copyright (c) Hathor Labs and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { jest, describe, test, expect, afterEach } from '@jest/globals';

const mockNavigation = {
  navigate: jest.fn(),
  goBack: jest.fn(),
  reset: jest.fn(),
  addListener: jest.fn(() => jest.fn()),
};
let mockParams = {};
jest.mock('../../src/hooks/navigation', () => ({
  useNavigation: () => mockNavigation,
  useParams: () => mockParams,
}));

// Every send the screen builds, with the facade and the arguments it was built with.
const mockSends = [];
const mockSendSetup = { feeHeader: null, fullTxData: null, buildError: null };
function mockCreateSend(facade, options) {
  const send = {
    facade,
    options,
    pin: options.pin ?? null,
    transaction: { getFeeHeader: () => mockSendSetup.feeHeader },
    fullTxData: mockSendSetup.fullTxData,
    run: jest.fn(async () => {
      if (mockSendSetup.buildError) {
        throw mockSendSetup.buildError;
      }
      return send.transaction;
    }),
    releaseUtxos: jest.fn(async () => {}),
    runFromMining: jest.fn(async () => send.transaction),
    on: jest.fn(),
    removeListener: jest.fn(),
  };
  mockSends.push(send);
  return send;
}
// wallet-lib's exports are getters that can't be spied on: a spread copy with fake send
// builders replaces them, and keeps every other export real.
jest.mock('@hathor/wallet-lib', () => ({
  ...jest.requireActual('@hathor/wallet-lib'),
  SendTransaction: jest.fn((options) => mockCreateSend('fullnode', options)),
  SendTransactionWalletService: jest.fn(
    (wallet, options) => mockCreateSend('wallet-service', { wallet, ...options }),
  ),
}));

/* eslint-disable import/first */
import React from 'react';
import { act, create } from 'react-test-renderer';
import { Provider } from 'react-redux';
import { legacy_createStore as createStore } from 'redux';
import { reducer } from '../../src/reducers/reducer';
import {
  networkSettingsUpdateState,
  setFeatureToggles,
  setFullNodeNetworkName,
  setUseWalletService,
  setWallet,
  shieldedCapabilityUpdate,
  shieldedProviderUpdate,
  tokenFetchBalanceSuccess,
} from '../../src/actions';
import {
  DEFAULT_TOKEN,
  FEATURE_TOGGLE_DEFAULTS,
  FULL_NETWORK_SHIELDED_TESTNET,
  PRE_SETTINGS_SHIELDED_TESTNET,
  SHIELDED_OUTPUTS_FEATURE_TOGGLE,
  SHIELDED_PROVIDER_STATUS,
} from '../../src/constants';
import { STORE } from '../../src/store';
import { PortalProvider } from '../../src/components/Portal';
import SendConfirmScreen from '../../src/screens/SendConfirmScreen';
/* eslint-enable import/first */

// Testnet addresses built with wallet-lib's address encoders from fixed keys.
const P2PKH = 'Wa9Q77VagNbzfecxW6g56jBuetkgEYyxoh';
const SHIELDED = 'K3KokZRo7DyNRRiyijpsVix2VADrd4HeA8vWLR5itAj81BVC4Vv7xoXbrYyKYwsLMWhefXqXKgJvC6HcVkDuJ7AJ7qUMS7fVc';
const HTR = { uid: DEFAULT_TOKEN.uid, name: DEFAULT_TOKEN.name, symbol: DEFAULT_TOKEN.symbol };

const capability = (level, cause = null) => ({
  level,
  reason: level === 'full' ? null : 'locked',
  cause,
  canReceive: level === 'full',
  canSpend: level === 'full',
  historyComplete: true,
  undecoded: { txIds: [], locked: 0, unreadable: 0, error: 0 },
});

const createWallet = () => ({
  storage: { name: 'wallet storage' },
  isReady: jest.fn(() => true),
  on: jest.fn(),
  removeListener: jest.fn(),
  getShieldedCapability: jest.fn(async () => capability('full')),
  unlockShieldedView: jest.fn(),
  signTx: jest.fn(async () => {}),
  validateAndRenewAuthToken: jest.fn(async () => {}),
});

let mounted = null;

afterEach(async () => {
  if (mounted) {
    await act(async () => { mounted.unmount(); });
    mounted = null;
  }
  jest.restoreAllMocks();
  jest.clearAllMocks();
  mockSends.length = 0;
  Object.assign(mockSendSetup, { feeHeader: null, fullTxData: null, buildError: null });
  mockParams = {};
});

// Lets the build that starts on mount, and the modals that open after it, settle. BackdropModal
// shows its content 100 ms after it opens.
const settle = () => act(async () => {
  await new Promise((resolve) => { setTimeout(resolve, 150); });
});

/**
 * Renders the send confirmation of a seed wallet on the shielded testnet, with a ready
 * provider, for the given route params.
 */
async function render(params, {
  wallet = createWallet(),
  flag = true,
  useWalletService = false,
  level = capability('full'),
} = {}) {
  jest.spyOn(STORE, 'isPasskeyWallet').mockReturnValue(false);
  mockParams = params;
  const store = createStore(reducer);
  store.dispatch(networkSettingsUpdateState(PRE_SETTINGS_SHIELDED_TESTNET));
  store.dispatch(setFeatureToggles({
    ...FEATURE_TOGGLE_DEFAULTS,
    [SHIELDED_OUTPUTS_FEATURE_TOGGLE]: flag,
  }));
  store.dispatch(setUseWalletService(useWalletService));
  store.dispatch(setFullNodeNetworkName(FULL_NETWORK_SHIELDED_TESTNET));
  store.dispatch(shieldedProviderUpdate({ status: SHIELDED_PROVIDER_STATUS.READY }));
  store.dispatch(shieldedCapabilityUpdate(level));
  store.dispatch(setWallet(wallet));
  store.dispatch(tokenFetchBalanceSuccess(params.token.uid, { available: 10000n, locked: 0n }));

  let renderer;
  await act(async () => {
    renderer = create(
      <Provider store={store}><PortalProvider><SendConfirmScreen /></PortalProvider></Provider>,
    );
  });
  mounted = renderer;
  await settle();

  const texts = () => renderer.root
    .findAll((node) => node.type === 'Text')
    .map((node) => [].concat(node.props.children).join(''));
  return { renderer, texts, wallet, store };
}

describe('SendConfirmScreen with private sends', () => {
  test('refuses to pay a private address in public', async () => {
    const { texts } = await render({ address: SHIELDED, amount: 100n, token: HTR });

    expect(mockSends).toEqual([]);
    expect(texts()).toContain('Payments to a private address are always private.');
  });

  test('builds a public send to a public address as before', async () => {
    const { wallet } = await render({ address: P2PKH, amount: 100n, token: HTR });

    expect(mockSends).toHaveLength(1);
    expect(mockSends[0].facade).toBe('fullnode');
    expect(mockSends[0].options).toEqual({
      storage: wallet.storage,
      outputs: [{ address: P2PKH, value: 100n, token: HTR.uid }],
    });
    expect(mockSends[0].run).toHaveBeenCalledWith('prepare-tx');
  });
});
