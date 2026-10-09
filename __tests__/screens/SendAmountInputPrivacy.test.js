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
  addListener: jest.fn(() => jest.fn()),
};
let mockParams = {};
jest.mock('../../src/hooks/navigation', () => ({
  useNavigation: () => mockNavigation,
  useParams: () => mockParams,
}));

/* eslint-disable import/first */
import React from 'react';
import { ActivityIndicator, Switch } from 'react-native';
import { act, create } from 'react-test-renderer';
import { Provider } from 'react-redux';
import { legacy_createStore as createStore, applyMiddleware } from 'redux';
import { reducer } from '../../src/reducers/reducer';
import {
  networkSettingsUpdateState,
  privacyDefaultModeSet,
  setFeatureToggles,
  setFullNodeNetworkName,
  setServerInfo,
  shieldedCapabilityUpdate,
  shieldedProviderUpdate,
  shieldedUnlockStatusUpdate,
  tokenFetchBalanceSuccess,
  types,
} from '../../src/actions';
import {
  DEFAULT_TOKEN,
  FEATURE_TOGGLE_DEFAULTS,
  FULL_NETWORK_SHIELDED_TESTNET,
  PRE_SETTINGS_SHIELDED_TESTNET,
  PRIVACY_MODE,
  SHIELDED_OUTPUTS_FEATURE_TOGGLE,
  SHIELDED_PROVIDER_STATUS,
  SHIELDED_UNLOCK_SOURCE,
} from '../../src/constants';
import { SHIELDED_UNLOCK_PROGRESS } from '../../src/shielded/unlockState';
import { PortalProvider } from '../../src/components/Portal';
import AmountTextInput from '../../src/components/AmountTextInput';
import PrivacyModeSelector from '../../src/components/PrivacyModeSelector';
import TransactionPrivacyModal from '../../src/components/TransactionPrivacyModal';
import SendAmountInput from '../../src/screens/SendAmountInput';
/* eslint-enable import/first */

// Testnet addresses built with wallet-lib's address encoders from fixed keys.
const P2PKH = 'Wa9Q77VagNbzfecxW6g56jBuetkgEYyxoh';
const SHIELDED = 'K3KokZRo7DyNRRiyijpsVix2VADrd4HeA8vWLR5itAj81BVC4Vv7xoXbrYyKYwsLMWhefXqXKgJvC6HcVkDuJ7AJ7qUMS7fVc';

/**
 * The capability at a level; below 'full', the private balance is locked, by default by a wrong
 * PIN, with `locked` private outputs the wallet holds but can't decode.
 */
const capability = (level, { cause = 'wrong-pin', locked = 0 } = {}) => ({
  level,
  reason: level === 'full' ? null : 'locked',
  cause: level === 'full' ? null : cause,
  canReceive: level === 'full',
  canSpend: level === 'full',
  historyComplete: true,
  undecoded: { txIds: [], locked, unreadable: 0, error: 0 },
});

let mounted = null;

afterEach(async () => {
  if (mounted) {
    await act(async () => { mounted.unmount(); });
    mounted = null;
  }
  jest.clearAllMocks();
  mockParams = {};
});

/**
 * Renders the amount screen of an HTR send to the address, for a seed wallet on the shielded
 * testnet with a ready provider, and a balance of 2^41 base units. `progress` is where the
 * unlock of the private balance stands, if one runs.
 */
async function render(address, {
  flag = true,
  level = capability('full'),
  progress = null,
} = {}) {
  mockParams = { address };
  const actions = [];
  const recordActions = () => (next) => (action) => {
    actions.push(action);
    return next(action);
  };
  const store = createStore(reducer, applyMiddleware(recordActions));
  store.dispatch(networkSettingsUpdateState(PRE_SETTINGS_SHIELDED_TESTNET));
  store.dispatch(setServerInfo({ decimal_places: 2, native_token: { name: 'Hathor', symbol: 'HTR' } }));
  store.dispatch(setFeatureToggles({
    ...FEATURE_TOGGLE_DEFAULTS,
    [SHIELDED_OUTPUTS_FEATURE_TOGGLE]: flag,
  }));
  store.dispatch(setFullNodeNetworkName(FULL_NETWORK_SHIELDED_TESTNET));
  store.dispatch(shieldedProviderUpdate({ status: SHIELDED_PROVIDER_STATUS.READY }));
  store.dispatch(shieldedCapabilityUpdate(level));
  store.dispatch(tokenFetchBalanceSuccess(DEFAULT_TOKEN.uid, { available: 2n ** 41n, locked: 0n }));
  if (progress) {
    store.dispatch(shieldedUnlockStatusUpdate(progress));
  }
  actions.length = 0;

  let renderer;
  await act(async () => {
    renderer = create(
      <Provider store={store}><PortalProvider><SendAmountInput /></PortalProvider></Provider>,
    );
  });
  mounted = renderer;

  const enterAmount = (text, value) => act(async () => {
    renderer.root.findByType(AmountTextInput).props.onAmountUpdate(text, value);
  });
  const next = () => act(async () => {
    renderer.root.find((node) => node.props.title === 'Next' && node.props.onPress).props.onPress();
  });
  const selector = () => renderer.root.findAllByType(PrivacyModeSelector);
  const texts = () => renderer.root
    .findAll((node) => node.type === 'Text')
    .map((node) => [].concat(node.props.children).join(''));
  const openSheet = async () => {
    await act(async () => { selector()[0].props.onPress(); });
    // BackdropModal shows its content 100 ms after it opens.
    await act(async () => { await new Promise((resolve) => { setTimeout(resolve, 150); }); });
  };
  const buttonTitles = () => renderer.root
    .findAll((node) => typeof node.props.title === 'string' && typeof node.props.onPress === 'function')
    .map((node) => node.props.title);
  const press = (title) => act(async () => {
    renderer.root.find(
      (node) => node.props.title === title && typeof node.props.onPress === 'function',
    ).props.onPress();
  });
  return {
    renderer,
    store,
    actions,
    enterAmount,
    next,
    selector,
    texts,
    openSheet,
    buttonTitles,
    press,
  };
}

const confirmParams = (address, amount, privacyMode) => ['SendConfirmScreen', {
  address,
  amount,
  token: DEFAULT_TOKEN,
  privacyMode,
}];

describe('SendAmountInput with private sends', () => {
  test('shows no privacy mode while the shielded UI is off, and sends in public', async () => {
    const { selector, renderer, enterAmount, next } = await render(P2PKH, { flag: false });

    expect(selector()).toEqual([]);
    expect(renderer.root.findAllByType(TransactionPrivacyModal)).toEqual([]);

    await enterAmount('1.00', 100n);
    await next();
    expect(mockNavigation.navigate).toHaveBeenCalledWith(
      ...confirmParams(P2PKH, 100n, PRIVACY_MODE.PUBLIC),
    );
  });

  test('picks no private mode while the shielded UI is off, even for a private address', async () => {
    // The flag can turn off after the address was taken: the send confirmation then refuses
    // to pay the private address in public.
    const { selector, enterAmount, next } = await render(SHIELDED, { flag: false });

    expect(selector()).toEqual([]);
    await enterAmount('1.00', 100n);
    await next();
    expect(mockNavigation.navigate).toHaveBeenCalledWith(
      ...confirmParams(SHIELDED, 100n, PRIVACY_MODE.PUBLIC),
    );
  });

  test('offers only Public to a legacy address, and says why', async () => {
    const { selector, texts, enterAmount, next } = await render(P2PKH);

    expect(selector()).toHaveLength(1);
    expect(selector()[0].props).toEqual(expect.objectContaining({
      mode: PRIVACY_MODE.PUBLIC,
      disabled: true,
    }));
    expect(texts()).toContain('Private sends need a private address.');

    await enterAmount('1.00', 100n);
    await next();
    expect(mockNavigation.navigate).toHaveBeenCalledWith(
      ...confirmParams(P2PKH, 100n, PRIVACY_MODE.PUBLIC),
    );
  });

  test('starts a send to a private address in Hide amount, and offers only private modes', async () => {
    const { selector, renderer, texts, openSheet } = await render(SHIELDED);

    expect(selector()[0].props).toEqual(expect.objectContaining({
      mode: PRIVACY_MODE.HIDE_AMOUNT,
      disabled: false,
    }));

    await openSheet();
    expect(renderer.root.findByType(TransactionPrivacyModal).props.options)
      .toEqual([PRIVACY_MODE.HIDE_AMOUNT, PRIVACY_MODE.PRIVATE]);
    expect(texts()).toContain('Payments to a private address are always private.');
    expect(renderer.root.findAllByType(Switch)).toHaveLength(2);
  });

  test('sends in the mode picked in the sheet', async () => {
    const { renderer, selector, openSheet, enterAmount, next } = await render(SHIELDED);

    await openSheet();
    await act(async () => {
      // Private is the first row, the most private mode.
      renderer.root.findAllByType(Switch)[0].props.onValueChange(true);
    });
    await act(async () => {
      renderer.root.find((node) => node.props.title === 'Done' && node.props.onPress).props.onPress();
    });
    expect(selector()[0].props.mode).toBe(PRIVACY_MODE.PRIVATE);

    await enterAmount('1.00', 100n);
    await next();
    expect(mockNavigation.navigate).toHaveBeenCalledWith(
      ...confirmParams(SHIELDED, 100n, PRIVACY_MODE.PRIVATE),
    );
  });

  test('sends a private address in Hide amount by default', async () => {
    const { enterAmount, next } = await render(SHIELDED);

    await enterAmount('1.00', 100n);
    await next();
    expect(mockNavigation.navigate).toHaveBeenCalledWith(
      ...confirmParams(SHIELDED, 100n, PRIVACY_MODE.HIDE_AMOUNT),
    );
  });

  test('offers the private modes to a locked wallet a PIN can unlock', async () => {
    const { selector } = await render(SHIELDED, { level: capability('watch') });

    expect(selector()[0].props.mode).toBe(PRIVACY_MODE.HIDE_AMOUNT);
  });

  test('caps a private send below 2^40 base units', async () => {
    const { enterAmount, next, texts } = await render(SHIELDED);

    await enterAmount('10995116277.76', 2n ** 40n);
    await next();

    expect(mockNavigation.navigate).not.toHaveBeenCalled();
    expect(texts()).toContain('A private send can be at most 10,995,116,277.75 HTR.');

    await enterAmount('10995116277.75', 2n ** 40n - 1n);
    await next();
    expect(mockNavigation.navigate).toHaveBeenCalledWith(
      ...confirmParams(SHIELDED, 2n ** 40n - 1n, PRIVACY_MODE.HIDE_AMOUNT),
    );
  });

  test('puts no cap on a public send', async () => {
    const { enterAmount, next } = await render(P2PKH);

    await enterAmount('10995116277.76', 2n ** 40n);
    await next();
    expect(mockNavigation.navigate).toHaveBeenCalledWith(
      ...confirmParams(P2PKH, 2n ** 40n, PRIVACY_MODE.PUBLIC),
    );
  });
});

describe('SendAmountInput with a locked private balance', () => {
  const UNLOCK = 'Unlock private balance';
  // The available balance leaves out the private outputs the wallet holds locked.
  const LOCKED = capability('watch', { locked: 2 });
  const PIN = '135790';

  test('says how many private outputs are locked, and offers to unlock them', async () => {
    const { texts, buttonTitles } = await render(SHIELDED, { level: LOCKED });

    expect(texts()).toContain('2 private outputs are locked');
    expect(buttonTitles()).toContain(UNLOCK);
  });

  test('offers the unlock when the amount is more than the balance without them', async () => {
    const { texts, buttonTitles, enterAmount, next } = await render(P2PKH, { level: LOCKED });

    await enterAmount('21990232555.53', 2n ** 41n + 1n);
    await next();

    expect(mockNavigation.navigate).not.toHaveBeenCalled();
    expect(texts()).toEqual(expect.arrayContaining([
      'Insufficient funds',
      '2 private outputs are locked',
    ]));
    expect(buttonTitles()).toContain(UNLOCK);
  });

  test('unlocks the private balance with the PIN', async () => {
    const { press, actions, store } = await render(P2PKH, { level: LOCKED });

    await press(UNLOCK);
    expect(mockNavigation.navigate).toHaveBeenCalledTimes(1);
    const [route, params] = mockNavigation.navigate.mock.calls[0];
    expect(route).toBe('PinScreen');
    expect(params).toEqual(expect.objectContaining({ canCancel: true }));

    await act(async () => { params.cb(PIN); });

    expect(actions.filter((action) => action.type === types.SHIELDED_VIEW_UNLOCK_REQUESTED))
      .toEqual([{
        type: types.SHIELDED_VIEW_UNLOCK_REQUESTED,
        payload: { pinCode: PIN, source: SHIELDED_UNLOCK_SOURCE.USER },
      }]);
    expect(JSON.stringify(store.getState().shielded)).not.toContain(PIN);
  });

  test.each([
    SHIELDED_UNLOCK_PROGRESS.UNLOCKING,
    SHIELDED_UNLOCK_PROGRESS.DECODING,
  ])('shows a spinner while the unlock is %s, until the balance is read again', async (status) => {
    // The unlocked wallet is at level full while it decodes the outputs it held locked.
    const level = status === SHIELDED_UNLOCK_PROGRESS.UNLOCKING ? LOCKED : capability('full');
    const { renderer, buttonTitles } = await render(P2PKH, { level, progress: { status } });

    expect(renderer.root.findAllByType(ActivityIndicator)).toHaveLength(1);
    expect(buttonTitles()).not.toContain(UNLOCK);
  });

  test.each([
    ['at level full', { level: capability('full') }],
    ['while no private output is locked', { level: capability('watch') }],
    ['for a scan key no PIN can unlock', { level: capability('watch', { cause: 'corrupt-key', locked: 2 }) }],
    ['while the shielded UI is off', { flag: false, level: LOCKED }],
  ])('shows no locked outputs and no unlock %s', async (_label, options) => {
    const { renderer, texts, buttonTitles } = await render(P2PKH, options);

    expect(texts().join(' ')).not.toContain('locked');
    expect(buttonTitles()).not.toContain(UNLOCK);
    expect(renderer.root.findAllByType(ActivityIndicator)).toEqual([]);
  });

  test('shows no spinner for an unlock while the shielded UI is off', async () => {
    const { renderer } = await render(P2PKH, {
      flag: false,
      level: capability('full'),
      progress: { status: SHIELDED_UNLOCK_PROGRESS.DECODING },
    });

    expect(renderer.root.findAllByType(ActivityIndicator)).toEqual([]);
  });
});

describe('SendAmountInput with a default privacy mode', () => {
  const setDefault = (store, mode) => act(async () => {
    store.dispatch(privacyDefaultModeSet(mode));
  });

  test('starts a send to a private address in the default saved for the network', async () => {
    const { store, selector, enterAmount, next } = await render(SHIELDED);

    await setDefault(store, PRIVACY_MODE.PRIVATE);
    expect(selector()[0].props.mode).toBe(PRIVACY_MODE.PRIVATE);

    await enterAmount('1.00', 100n);
    await next();
    expect(mockNavigation.navigate).toHaveBeenCalledWith(
      ...confirmParams(SHIELDED, 100n, PRIVACY_MODE.PRIVATE),
    );
  });

  test('starts a send to a legacy address in Public, whatever the default', async () => {
    const { store, selector, enterAmount, next } = await render(P2PKH);

    await setDefault(store, PRIVACY_MODE.PRIVATE);
    expect(selector()[0].props.mode).toBe(PRIVACY_MODE.PUBLIC);

    await enterAmount('1.00', 100n);
    await next();
    expect(mockNavigation.navigate).toHaveBeenCalledWith(
      ...confirmParams(P2PKH, 100n, PRIVACY_MODE.PUBLIC),
    );
  });

  test('keeps the mode picked in the sheet over the default', async () => {
    const { store, renderer, selector, openSheet } = await render(SHIELDED);
    await setDefault(store, PRIVACY_MODE.PRIVATE);

    await openSheet();
    await act(async () => {
      // Hide amount is the second row.
      renderer.root.findAllByType(Switch)[1].props.onValueChange(true);
    });
    await act(async () => {
      renderer.root.find((node) => node.props.title === 'Done' && node.props.onPress).props.onPress();
    });

    expect(selector()[0].props.mode).toBe(PRIVACY_MODE.HIDE_AMOUNT);
  });

  test('picks no private mode from the default while the shielded UI is off', async () => {
    const { store, enterAmount, next } = await render(SHIELDED, { flag: false });

    await setDefault(store, PRIVACY_MODE.PRIVATE);
    await enterAmount('1.00', 100n);
    await next();
    expect(mockNavigation.navigate).toHaveBeenCalledWith(
      ...confirmParams(SHIELDED, 100n, PRIVACY_MODE.PUBLIC),
    );
  });
});
