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
function mockCreateSend(send, facade, options) {
  Object.assign(send, {
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
  });
  mockSends.push(send);
}
// wallet-lib's exports are getters that can't be spied on: a spread copy with fake send
// builders replaces them, and keeps every other export real. The fakes are instances of the
// mocked classes, as the feedback modal's prop types expect.
jest.mock('@hathor/wallet-lib', () => ({
  ...jest.requireActual('@hathor/wallet-lib'),
  SendTransaction: jest.fn(function mockSendTransaction(options) {
    mockCreateSend(this, 'fullnode', options);
  }),
  SendTransactionWalletService: jest.fn(function mockSendTransactionWalletService(wallet, options) {
    mockCreateSend(this, 'wallet-service', { wallet, ...options });
  }),
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
  PRIVACY_MODE,
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
  providerStatus = SHIELDED_PROVIDER_STATUS.READY,
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
  store.dispatch(shieldedProviderUpdate({ status: providerStatus }));
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

  test('builds a public send from the storage, as before, where no provider is registered', async () => {
    const { wallet } = await render(
      { address: P2PKH, amount: 100n, token: HTR },
      { providerStatus: SHIELDED_PROVIDER_STATUS.UNREGISTERED },
    );

    expect(mockSends).toHaveLength(1);
    expect(mockSends[0].facade).toBe('fullnode');
    expect(mockSends[0].options).toEqual({
      storage: wallet.storage,
      outputs: [{ address: P2PKH, value: 100n, token: HTR.uid }],
    });
    expect(mockSends[0].run).toHaveBeenCalledWith('prepare-tx');
  });

  test.each([
    [PRIVACY_MODE.HIDE_AMOUNT, 1],
    [PRIVACY_MODE.PRIVATE, 2],
  ])('builds a %s send with the wallet and the shielded mode, and nothing else', async (privacyMode, shieldedMode) => {
    const { wallet } = await render({
      address: SHIELDED,
      amount: 100n,
      token: HTR,
      privacyMode,
    });

    expect(mockSends).toHaveLength(1);
    const { facade, options } = mockSends[0];
    expect(facade).toBe('fullnode');
    // No changeShieldedMode, changeAddress, inputs or pin: wallet-lib's rules complete the lone
    // private output and decide the change.
    expect(Object.keys(options)).toEqual(['wallet', 'outputs']);
    expect(options.wallet).toBe(wallet);
    expect(options.outputs).toEqual([{
      address: SHIELDED,
      value: 100n,
      token: HTR.uid,
      shieldedMode,
    }]);
    expect(wallet.getShieldedCapability).toHaveBeenCalled();
  });

  test('builds a public send with the wallet where a provider is registered, with no mode', async () => {
    const { wallet } = await render({
      address: P2PKH,
      amount: 100n,
      token: HTR,
      privacyMode: PRIVACY_MODE.PUBLIC,
    });

    expect(mockSends).toHaveLength(1);
    const { options } = mockSends[0];
    expect(Object.keys(options)).toEqual(['wallet', 'outputs']);
    expect(options.wallet).toBe(wallet);
    expect(options.outputs).toEqual([{ address: P2PKH, value: 100n, token: HTR.uid }]);
    // A key holding undefined would fail the build: "Invalid shieldedMode 'undefined'".
    expect('shieldedMode' in options.outputs[0]).toBe(false);
    // A public send needs no level.
    expect(wallet.getShieldedCapability).not.toHaveBeenCalled();
  });

  test('builds on the wallet-service facade as before, with no mode', async () => {
    const { wallet } = await render(
      { address: P2PKH, amount: 100n, token: HTR, privacyMode: PRIVACY_MODE.PUBLIC },
      { useWalletService: true, providerStatus: SHIELDED_PROVIDER_STATUS.UNREGISTERED },
    );

    expect(mockSends).toHaveLength(1);
    expect(mockSends[0].facade).toBe('wallet-service');
    expect(mockSends[0].options).toEqual({
      wallet,
      outputs: [{ address: P2PKH, value: 100n, token: HTR.uid }],
    });
  });

  test('refuses a private mode on the wallet-service facade', async () => {
    const { texts } = await render(
      { address: SHIELDED, amount: 100n, token: HTR, privacyMode: PRIVACY_MODE.HIDE_AMOUNT },
      { useWalletService: true, providerStatus: SHIELDED_PROVIDER_STATUS.UNREGISTERED },
    );

    expect(mockSends).toEqual([]);
    expect(texts()).toContain('Private transfers are not available for this wallet.');
  });

  test('waits for the wallet to be ready before it builds', async () => {
    const wallet = createWallet();
    let ready = false;
    wallet.isReady.mockImplementation(() => ready);
    const { renderer } = await render(
      { address: SHIELDED, amount: 100n, token: HTR, privacyMode: PRIVACY_MODE.HIDE_AMOUNT },
      { wallet },
    );

    expect(mockSends).toEqual([]);
    expect(renderer.root.findAll((node) => node.props.text === 'Building your transaction'))
      .not.toEqual([]);
    const [[event, onState]] = wallet.on.mock.calls;
    expect(event).toBe('state');

    // Another state change that leaves the wallet processing.
    await act(async () => { onState('Processing'); });
    expect(mockSends).toEqual([]);

    ready = true;
    await act(async () => { onState('Ready'); });
    await settle();
    expect(mockSends).toHaveLength(1);
    expect(wallet.removeListener).toHaveBeenCalledWith('state', onState);
  });

  test('stops waiting for the wallet when the screen leaves', async () => {
    const wallet = createWallet();
    wallet.isReady.mockReturnValue(false);
    const { renderer } = await render(
      { address: P2PKH, amount: 100n, token: HTR, privacyMode: PRIVACY_MODE.PUBLIC },
      { wallet },
    );
    const [[, onState]] = wallet.on.mock.calls;

    await act(async () => { renderer.unmount(); });
    mounted = null;

    expect(wallet.removeListener).toHaveBeenCalledWith('state', onState);
    expect(mockSends).toEqual([]);
  });

  test('lets the user leave while the build waits for the wallet', async () => {
    const wallet = createWallet();
    wallet.isReady.mockReturnValue(false);
    const { renderer } = await render(
      { address: P2PKH, amount: 100n, token: HTR, privacyMode: PRIVACY_MODE.PUBLIC },
      { wallet },
    );

    const building = renderer.root.find((node) => node.props.text === 'Building your transaction');
    await act(async () => { building.props.onDismiss(); });
    expect(mockNavigation.goBack).toHaveBeenCalled();
  });

  test.each([
    ['locked by a PIN', capability('watch', 'wrong-pin'), 'Your private balance is locked. Unlock it to send privately.'],
    ['locked with a corrupt scan key', capability('watch', 'corrupt-key'), 'Private transfers are not available for this wallet.'],
    ['at level none', capability('none'), 'Private transfers are not available for this wallet.'],
  ])('builds no private send while the private balance is %s', async (_label, level, message) => {
    const wallet = createWallet();
    wallet.getShieldedCapability.mockResolvedValue(level);
    const { texts } = await render(
      { address: SHIELDED, amount: 100n, token: HTR, privacyMode: PRIVACY_MODE.HIDE_AMOUNT },
      { wallet },
    );

    expect(mockSends).toEqual([]);
    expect(texts()).toContain(message);
  });

  test('releases the selected UTXOs when the screen leaves', async () => {
    const { renderer } = await render({
      address: SHIELDED,
      amount: 100n,
      token: HTR,
      privacyMode: PRIVACY_MODE.HIDE_AMOUNT,
    });
    expect(mockSends[0].releaseUtxos).not.toHaveBeenCalled();

    await act(async () => { renderer.unmount(); });
    mounted = null;

    expect(mockSends[0].releaseUtxos).toHaveBeenCalled();
  });

  test('signs the send with the PIN, then mines it, and the send keeps no PIN', async () => {
    const { renderer, wallet } = await render({
      address: SHIELDED,
      amount: 100n,
      token: HTR,
      privacyMode: PRIVACY_MODE.HIDE_AMOUNT,
    });

    await act(async () => {
      renderer.root.find((node) => node.props.title === 'Send' && node.props.onPress).props.onPress();
    });
    const [screen, pinParams] = mockNavigation.navigate.mock.calls[0];
    expect(screen).toBe('PinScreen');

    await act(async () => { pinParams.cb('123456'); });
    await settle();

    const [send] = mockSends;
    expect(wallet.signTx).toHaveBeenCalledWith(send.transaction, { pinCode: '123456' });
    expect(send.runFromMining).toHaveBeenCalled();
    expect(wallet.signTx.mock.invocationCallOrder[0])
      .toBeLessThan(send.runFromMining.mock.invocationCallOrder[0]);
    expect(send.pin).toBeNull();
  });
});
