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
jest.mock('../../src/NavigationService', () => ({
  __esModule: true,
  default: { navigate: jest.fn(), resetToMain: jest.fn(), setTopLevelNavigator: jest.fn() },
}));

// Every send the screen builds, with the facade and the arguments it was built with. A build
// waits for `pendingRun`, when a test sets it.
const mockSends = [];
const mockSendSetup = {
  feeHeader: null,
  fullTxData: null,
  buildError: null,
  pendingRun: null,
};
function mockCreateSend(send, facade, options) {
  Object.assign(send, {
    facade,
    options,
    pin: options.pin ?? null,
    transaction: { getFeeHeader: () => mockSendSetup.feeHeader },
    fullTxData: mockSendSetup.fullTxData,
    run: jest.fn(async () => {
      if (mockSendSetup.pendingRun) {
        await mockSendSetup.pendingRun;
      }
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
import { errors } from '@hathor/wallet-lib';
import { TouchableOpacity } from 'react-native';
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
import NavigationService from '../../src/NavigationService';
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
  Object.assign(mockSendSetup, {
    feeHeader: null,
    fullTxData: null,
    buildError: null,
    pendingRun: null,
  });
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

  test('builds at once where no provider is registered, even while the wallet is not ready', async () => {
    // Only the wallet-bound build waits for the wallet: elsewhere the build is as before.
    const wallet = createWallet();
    wallet.isReady.mockReturnValue(false);
    await render(
      { address: P2PKH, amount: 100n, token: HTR, privacyMode: PRIVACY_MODE.PUBLIC },
      { wallet, providerStatus: SHIELDED_PROVIDER_STATUS.UNREGISTERED },
    );

    expect(mockSends).toHaveLength(1);
    expect(mockSends[0].options).toEqual({
      storage: wallet.storage,
      outputs: [{ address: P2PKH, value: 100n, token: HTR.uid }],
    });
    expect(wallet.on).not.toHaveBeenCalledWith('state', expect.anything());
  });

  test('keeps the building spinner as before where no provider is registered: it can not be dismissed', async () => {
    let finishBuild;
    mockSendSetup.pendingRun = new Promise((resolve) => { finishBuild = resolve; });
    const { renderer } = await render(
      { address: P2PKH, amount: 100n, token: HTR, privacyMode: PRIVACY_MODE.PUBLIC },
      { providerStatus: SHIELDED_PROVIDER_STATUS.UNREGISTERED },
    );

    const building = renderer.root.find((node) => node.props.text === 'Building your transaction');
    expect(building.props.onDismiss).toBeUndefined();

    await act(async () => { finishBuild(); });
    await settle();
    expect(renderer.root.findAll((node) => node.props.text === 'Building your transaction'))
      .toEqual([]);
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

describe('SendConfirmScreen fees and summary', () => {
  const PRIVATE_SEND = {
    address: SHIELDED,
    amount: 100n,
    token: HTR,
    privacyMode: PRIVACY_MODE.HIDE_AMOUNT,
  };
  const expandFees = (renderer) => act(async () => {
    renderer.root.find((node) => node.props.privateOutputs !== undefined && node.props.total)
      .findAllByType(TouchableOpacity)[0].props.onPress();
  });

  test('breaks the fee of a send that pays a privacy fee down', async () => {
    mockSendSetup.feeHeader = { entries: [{ tokenIndex: 0, amount: 3n }] };
    mockSendSetup.fullTxData = { shieldedOutputs: [{ shieldedMode: 1 }, { shieldedMode: 2 }] };
    const { renderer, texts } = await render(PRIVATE_SEND);

    expect(texts()).toEqual(expect.arrayContaining(['Fees', '0.03 HTR', '1.00 HTR + 0.03 HTR']));
    expect(texts()).not.toContain('Network Fee');

    await expandFees(renderer);
    expect(texts()).toEqual(expect.arrayContaining(['Privacy fee', '2 private outputs']));
    expect(texts()).not.toContain('Network fee');
  });

  test('keeps the network fee row of a send that pays no privacy fee', async () => {
    mockSendSetup.feeHeader = { entries: [{ tokenIndex: 0, amount: 1n }] };
    const { texts } = await render({
      address: P2PKH, amount: 100n, token: HTR, privacyMode: PRIVACY_MODE.PUBLIC,
    });

    expect(texts()).toEqual(expect.arrayContaining(['Network Fee', '1.00 HTR + 0.01 HTR']));
    expect(texts()).not.toContain('Fees');
  });

  test('breaks down the privacy fee of a public send that spends private funds', async () => {
    // Its change is private, so it pays a privacy fee for it, and the split it needs.
    mockSendSetup.feeHeader = { entries: [{ tokenIndex: 0, amount: 2n }] };
    mockSendSetup.fullTxData = { shieldedOutputs: [{ shieldedMode: 1 }, { shieldedMode: 1 }] };
    const { texts } = await render({
      address: P2PKH, amount: 100n, token: HTR, privacyMode: PRIVACY_MODE.PUBLIC,
    }, { flag: false });

    expect(texts()).toEqual(expect.arrayContaining(['Fees', '0.02 HTR']));
  });

  test('shows the privacy mode, and that the recipient is a private address', async () => {
    const { texts } = await render(PRIVATE_SEND);

    expect(texts()).toEqual(expect.arrayContaining(['Privacy', 'Hide amount', 'Private address']));
  });

  test('shows Public for a send to a legacy address where private sends are available', async () => {
    const { texts } = await render({
      address: P2PKH, amount: 100n, token: HTR, privacyMode: PRIVACY_MODE.PUBLIC,
    });

    expect(texts()).toEqual(expect.arrayContaining(['Privacy', 'Public']));
    expect(texts()).not.toContain('Private address');
  });

  test('shows no privacy while the shielded UI is off', async () => {
    const { texts } = await render({
      address: P2PKH, amount: 100n, token: HTR, privacyMode: PRIVACY_MODE.PUBLIC,
    }, { flag: false });

    expect(texts()).not.toContain('Privacy');
    expect(texts()).not.toContain('Private address');
  });

  test('fails a send whose fee is in another token, and releases its UTXOs', async () => {
    mockSendSetup.feeHeader = { entries: [{ tokenIndex: 1, amount: 1n }] };
    const { renderer, texts } = await render(PRIVATE_SEND);

    expect(texts()).toContain('Unexpected fee entry with non-HTR token index');

    await act(async () => { renderer.unmount(); });
    mounted = null;
    expect(mockSends[0].releaseUtxos).toHaveBeenCalled();
  });
});

describe('SendConfirmScreen unlock of a locked private balance', () => {
  const PRIVATE_SEND = {
    address: SHIELDED,
    amount: 100n,
    token: HTR,
    privacyMode: PRIVACY_MODE.PRIVATE,
  };
  const PIN = '123456';

  /**
   * A wallet whose private balance is locked, and which unlocks with PIN: its walk ends when
   * the test calls finishWalk.
   */
  const createLockedWallet = () => {
    const wallet = createWallet();
    let level = capability('watch', 'wrong-pin');
    let finishWalk;
    const reprocessed = new Promise((resolve) => { finishWalk = resolve; });
    wallet.getShieldedCapability.mockImplementation(async () => level);
    wallet.unlockShieldedView.mockImplementation(async ({ pinCode }) => {
      if (pinCode !== PIN) {
        throw new errors.ShieldedKeyError('shielded-wrong-pin', 'The PIN does not decrypt the scan key.');
      }
      level = capability('full');
      return { capability: level, reprocessed };
    });
    return { wallet, finishWalk: () => act(async () => { finishWalk(level); }) };
  };

  const pressUnlock = async (renderer) => {
    await act(async () => {
      renderer.root.find((node) => node.props.title === 'Unlock private balance' && node.props.onPress)
        .props.onPress();
    });
    const [screen, pinParams] = mockNavigation.navigate.mock.calls.at(-1);
    expect(screen).toBe('PinScreen');
    return pinParams;
  };
  // The send screen gets the focus back when the PIN screen closes.
  const refocus = () => act(async () => {
    mockNavigation.addListener.mock.calls
      .filter(([event]) => event === 'focus')
      .forEach(([, listener]) => listener());
  });

  test('asks to unlock instead of building', async () => {
    const { wallet } = createLockedWallet();
    const { texts } = await render(PRIVATE_SEND, { wallet });

    expect(mockSends).toEqual([]);
    expect(texts()).toEqual(expect.arrayContaining([
      'Your private balance is locked. Unlock it to send privately.',
      'Unlock private balance',
    ]));
    expect(wallet.unlockShieldedView).not.toHaveBeenCalled();
  });

  test('unlocks with the PIN, waits for the walk, then builds the send once', async () => {
    const { wallet, finishWalk } = createLockedWallet();
    const { renderer, texts, store } = await render(PRIVATE_SEND, { wallet });

    const pinParams = await pressUnlock(renderer);
    expect(pinParams).toEqual({
      cb: expect.any(Function),
      canCancel: true,
      screenText: 'Enter your 6-digit pin to unlock your private balance',
      biometryText: 'Unlock private balance',
    });
    // The PIN screen opens over the send screen: the locked modal leaves the way.
    await settle();
    expect(texts()).not.toContain('Unlock private balance');

    await act(async () => { pinParams.cb(PIN); });
    await settle();
    expect(wallet.unlockShieldedView).toHaveBeenCalledWith({ pinCode: PIN });
    expect(texts()).toContain('Reading your private balance');
    expect(mockSends).toEqual([]);

    await finishWalk();
    await settle();
    expect(mockSends).toHaveLength(1);
    expect(mockSends[0].options.outputs[0].shieldedMode).toBe(2);
    expect(texts()).not.toContain('Reading your private balance');
    // The PIN never reaches the redux state.
    expect(JSON.stringify(store.getState(), (_key, value) => (
      typeof value === 'bigint' ? value.toString() : value
    ))).not.toContain(PIN);
  });

  test('says so when the unlock fails, and builds nothing', async () => {
    const { wallet } = createLockedWallet();
    const { renderer, texts } = await render(PRIVATE_SEND, { wallet });

    const pinParams = await pressUnlock(renderer);
    await act(async () => { pinParams.cb('000000'); });
    await settle();

    expect(texts()).toContain('Could not unlock your private balance.');
    expect(mockSends).toEqual([]);
  });

  test('asks again when the PIN screen is cancelled', async () => {
    const { wallet } = createLockedWallet();
    const { renderer, texts } = await render(PRIVATE_SEND, { wallet });

    await pressUnlock(renderer);
    await refocus();
    await settle();

    expect(texts()).toContain('Unlock private balance');
    expect(wallet.unlockShieldedView).not.toHaveBeenCalled();
  });

  test('builds once another PIN entry unlocked the wallet first', async () => {
    const { wallet } = createLockedWallet();
    const { renderer } = await render(PRIVATE_SEND, { wallet });
    const pinParams = await pressUnlock(renderer);

    // The lock screen, say, unlocked it meanwhile.
    wallet.getShieldedCapability.mockResolvedValue(capability('full'));
    await act(async () => { pinParams.cb(PIN); });
    await settle();

    expect(wallet.unlockShieldedView).not.toHaveBeenCalled();
    expect(mockSends).toHaveLength(1);
  });

  test('lets the user leave while the wallet decodes', async () => {
    const { wallet } = createLockedWallet();
    const { renderer } = await render(PRIVATE_SEND, { wallet });
    const pinParams = await pressUnlock(renderer);
    await act(async () => { pinParams.cb(PIN); });
    await settle();

    const decoding = renderer.root.find((node) => node.props.text === 'Reading your private balance');
    await act(async () => { decoding.props.onDismiss(); });
    expect(mockNavigation.goBack).toHaveBeenCalled();
  });

  test('builds a public send while the private balance is locked', async () => {
    const { wallet } = createLockedWallet();
    await render(
      { address: P2PKH, amount: 100n, token: HTR, privacyMode: PRIVACY_MODE.PUBLIC },
      { wallet },
    );

    expect(mockSends).toHaveLength(1);
    expect(wallet.unlockShieldedView).not.toHaveBeenCalled();
  });
});

describe('SendConfirmScreen after a send', () => {
  test('goes home, then starts the send flow again at the address input', async () => {
    const { renderer } = await render(
      { address: P2PKH, amount: 100n, token: HTR, privacyMode: PRIVACY_MODE.PUBLIC },
      { providerStatus: SHIELDED_PROVIDER_STATUS.UNREGISTERED },
    );
    await act(async () => {
      renderer.root.find((node) => node.props.title === 'Send' && node.props.onPress).props.onPress();
    });
    const [, pinParams] = mockNavigation.navigate.mock.calls[0];
    await act(async () => { pinParams.cb('123456'); });
    await settle();

    const feedback = renderer.root.find((node) => typeof node.props.onDismissSuccess === 'function');
    await act(async () => { feedback.props.onDismissSuccess(); });
    expect(NavigationService.navigate).toHaveBeenCalledWith('Main', { screen: 'Home' });

    // The send stack is reset once the home screen shows.
    await act(async () => { await new Promise((resolve) => { setTimeout(resolve, 550); }); });
    expect(mockNavigation.reset).toHaveBeenCalledWith({
      index: 0,
      routes: [{ name: 'SendAddressInput' }],
    });
  });
});
