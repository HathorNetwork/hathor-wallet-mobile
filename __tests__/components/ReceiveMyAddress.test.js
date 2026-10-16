/**
 * Copyright (c) Hathor Labs and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { jest, describe, test, expect, afterEach } from '@jest/globals';

// The QR code draws with react-native-svg; a placeholder keeps its value to assert on.
jest.mock('react-native-qrcode-svg', () => 'QRCode');

/* eslint-disable import/first */
import React from 'react';
import { Share } from 'react-native';
import { act, create } from 'react-test-renderer';
import { Provider } from 'react-redux';
import { legacy_createStore as createStore, applyMiddleware } from 'redux';
import { reducer } from '../../src/reducers/reducer';
import {
  setAddressMode,
  setFeatureToggles,
  setFullNodeNetworkName,
  setUseWalletService,
  setWallet,
  sharedAddressUpdate,
  shieldedProviderUpdate,
  shieldedReceiveAddressUpdate,
  startWalletSuccess,
  types,
} from '../../src/actions';
import {
  ADDRESS_MODE,
  FEATURE_TOGGLE_DEFAULTS,
  FULL_NETWORK_SHIELDED_TESTNET,
  SHIELDED_OUTPUTS_FEATURE_TOGGLE,
  SHIELDED_PROVIDER_STATUS,
  SHIELDED_UNLOCK_SOURCE,
} from '../../src/constants';
import { RECEIVE_REASON_ERROR, SHIELDED_RECEIVE_STATUS } from '../../src/shielded/receiveState';
import ReceiveMyAddress from '../../src/components/ReceiveMyAddress';
/* eslint-enable import/first */

// Testnet addresses built with wallet-lib's address encoders from fixed keys.
const LEGACY_ADDRESS = 'Wa9Q77VagNbzfecxW6g56jBuetkgEYyxoh';
const NEW_ADDRESS = 'K3KokZRo7DyNRRiyijpsVix2VADrd4HeA8vWLR5itAj81BVC4Vv7xoXbrYyKYwsLMWhefXqXKgJvC6HcVkDuJ7AJ7qUMS7fVc';
const NEXT_LEGACY_ADDRESS = 'WNEXT_LEGACY_ADDRESS';
const PIN = '112358';

let mounted = null;

afterEach(async () => {
  jest.restoreAllMocks();
  if (mounted) {
    await act(async () => { mounted.unmount(); });
    mounted = null;
  }
});

/**
 * Renders the Receive screen's address view on a store whose wallet runs on the shielded
 * testnet, on the fullnode facade, with a ready provider, unless told otherwise. With the flag
 * on, that's the shielded environment, where the shared address is the wallet's new address once
 * it can be read.
 */
async function render({
  flag = true,
  network = FULL_NETWORK_SHIELDED_TESTNET,
  providerStatus = SHIELDED_PROVIDER_STATUS.READY,
  useWalletService = false,
  receive = null,
  shared = flag ? NEW_ADDRESS : LEGACY_ADDRESS,
  addressMode = ADDRESS_MODE.MULTI,
  walletReady = true,
} = {}) {
  const actions = [];
  const recordActions = () => (next) => (action) => {
    actions.push(action);
    return next(action);
  };
  const wallet = {
    getNextAddress: jest.fn(async (opts) => (opts?.legacy === false
      ? { address: NEW_ADDRESS, index: 1 }
      : { address: NEXT_LEGACY_ADDRESS, index: 1 })),
  };
  const store = createStore(reducer, applyMiddleware(recordActions));
  store.dispatch(setFeatureToggles({
    ...FEATURE_TOGGLE_DEFAULTS,
    [SHIELDED_OUTPUTS_FEATURE_TOGGLE]: flag,
  }));
  store.dispatch(setUseWalletService(useWalletService));
  store.dispatch(setFullNodeNetworkName(network));
  store.dispatch(shieldedProviderUpdate({ status: providerStatus }));
  store.dispatch(setWallet(wallet));
  store.dispatch(sharedAddressUpdate(shared, 0));
  store.dispatch(setAddressMode(addressMode));
  if (walletReady) {
    store.dispatch(startWalletSuccess());
  }
  if (receive) {
    store.dispatch(shieldedReceiveAddressUpdate(receive));
  }
  actions.length = 0;
  const navigation = { navigate: jest.fn() };

  let renderer;
  await act(async () => {
    renderer = create(
      <Provider store={store}><ReceiveMyAddress navigation={navigation} /></Provider>,
    );
  });
  mounted = renderer;

  const text = () => JSON.stringify(renderer.toJSON());
  const qrValues = () => renderer.root.findAllByType('QRCode').map((node) => node.props.value);
  const buttonTitles = () => renderer.root
    .findAll((node) => typeof node.props.title === 'string' && typeof node.props.onPress === 'function')
    .map((node) => node.props.title);
  const tabs = () => renderer.root
    .findAll((node) => typeof node.props.optionValue === 'string')
    .map((node) => node.props.optionValue);
  const press = (title) => act(async () => {
    await renderer.root.find(
      (node) => node.props.title === title && typeof node.props.onPress === 'function',
    ).props.onPress();
  });
  return {
    store, actions, wallet, navigation, text, qrValues, buttonTitles, tabs, press,
  };
}

const receive = (status, fields = {}) => ({
  status, address: null, index: null, reason: null, ...fields,
});
const READY_RECEIVE = receive(SHIELDED_RECEIVE_STATUS.READY, {
  address: NEW_ADDRESS,
  index: 0,
});

describe('ReceiveMyAddress outside the shielded environment', () => {
  test('shows the legacy address, with New address and Share', async () => {
    const { tabs, qrValues, buttonTitles, text } = await render({ flag: false });

    expect(tabs()).toEqual([]);
    expect(qrValues()).toEqual([`hathor:${LEGACY_ADDRESS}`]);
    expect(text()).toContain(LEGACY_ADDRESS);
    expect(buttonTitles()).toEqual(['New address', 'Share']);
  });

  test('hides New address in single-address mode', async () => {
    const { buttonTitles } = await render({ flag: false, addressMode: ADDRESS_MODE.SINGLE });

    expect(buttonTitles()).toEqual(['Share']);
  });

  test.each([
    ['the shielded UI is off', { flag: false }],
    ['the node reports another network', {
      network: 'testnet',
      providerStatus: SHIELDED_PROVIDER_STATUS.UNREGISTERED,
    }],
  ])('shows no new address, nor where it stands, while %s', async (_label, options) => {
    const { qrValues, text, buttonTitles, actions } = await render({
      ...options,
      shared: LEGACY_ADDRESS,
      receive: receive(SHIELDED_RECEIVE_STATUS.LOCKED, { reason: 'wrong-pin' }),
    });

    expect(qrValues()).toEqual([`hathor:${LEGACY_ADDRESS}`]);
    expect(text()).not.toContain(NEW_ADDRESS);
    expect(text()).not.toContain('Private receiving is locked');
    expect(buttonTitles()).toEqual(['New address', 'Share']);
    // Nor does it read the shielded address when it opens.
    expect(actions).toEqual([]);
  });

  test('shares the next legacy address on New address', async () => {
    const { press, wallet, store } = await render({ flag: false });

    await press('New address');

    expect(wallet.getNextAddress).toHaveBeenCalledWith();
    expect(store.getState().lastSharedAddress).toBe(NEXT_LEGACY_ADDRESS);
  });
});

describe('ReceiveMyAddress in the shielded environment', () => {
  test('shows only the new address: no toggle, no legacy address', async () => {
    const { tabs, qrValues, buttonTitles, text } = await render({ receive: READY_RECEIVE });

    expect(tabs()).toEqual([]);
    expect(qrValues()).toEqual([`hathor:${NEW_ADDRESS}`]);
    expect(text()).toContain(NEW_ADDRESS);
    expect(text()).not.toContain(LEGACY_ADDRESS);
    expect(text()).not.toContain('Only wallets that support private transfers can pay this address.');
    expect(buttonTitles()).toEqual(['New address', 'Share']);
  });

  test('shares the new address as "Here is my address"', async () => {
    const share = jest.spyOn(Share, 'share').mockResolvedValue({});
    const { press } = await render({ receive: READY_RECEIVE });

    await press('Share');

    expect(share).toHaveBeenCalledWith({ message: `Here is my address: ${NEW_ADDRESS}` });
  });

  test('moves to the next new address on New address, then reads the shared address again', async () => {
    const { press, wallet, actions } = await render({ receive: READY_RECEIVE });
    // The read when Receive opens.
    actions.length = 0;

    await press('New address');

    expect(wallet.getNextAddress).toHaveBeenCalledWith({ legacy: false });
    expect(actions.map((action) => action.type)).toEqual([types.WALLET_REFRESH_SHARED_ADDRESS]);
  });

  test('reads the shared address again when Receive opens on a ready wallet', async () => {
    const ready = await render({ receive: READY_RECEIVE });

    expect(ready.actions.map((action) => action.type))
      .toEqual([types.WALLET_REFRESH_SHARED_ADDRESS]);
  });

  test('reads nothing while the wallet loads', async () => {
    const loading = await render({ walletReady: false });

    expect(loading.actions).toEqual([]);
  });

  test('asks to unlock the private balance of a locked wallet', async () => {
    const view = await render({
      receive: receive(SHIELDED_RECEIVE_STATUS.LOCKED, { reason: 'wrong-pin' }),
      shared: null,
    });
    const { text, qrValues, press } = view;

    expect(qrValues()).toEqual([]);
    expect(text()).toContain('Private receiving is locked');
    expect(text()).toContain('Unlock your private balance to receive private payments and see your private funds.');
    await press('Unlock private balance');
    const [route, params] = view.navigation.navigate.mock.calls[0];
    expect(route).toBe('PinScreen');
    await act(async () => { params.cb(PIN); });
    expect(view.actions).toContainEqual({
      type: types.SHIELDED_VIEW_UNLOCK_REQUESTED,
      payload: { pinCode: PIN, source: SHIELDED_UNLOCK_SOURCE.USER },
    });
  });

  test.each([
    ['no-provider', 'Private transfers could not be loaded on this device.'],
    ['shielded-no-provider', 'Private transfers could not be loaded on this device.'],
    ['needs-password', 'Private transfers are not available for this wallet.'],
    ['corrupt-key', 'Private transfers are not available for this wallet.'],
  ])('says why it cannot receive privately, for the reason %s', async (reason, explanation) => {
    const { text, qrValues, buttonTitles } = await render({
      receive: receive(SHIELDED_RECEIVE_STATUS.UNAVAILABLE, { reason }),
      shared: null,
    });

    expect(qrValues()).toEqual([]);
    expect(buttonTitles()).toEqual([]);
    expect(text()).toContain('Private receiving is unavailable');
    expect(text()).toContain(explanation);
  });

  test('offers a retry when the new address could not be read', async () => {
    const { text, qrValues, buttonTitles, press, actions } = await render({
      receive: receive(SHIELDED_RECEIVE_STATUS.UNAVAILABLE, { reason: RECEIVE_REASON_ERROR }),
      shared: null,
    });
    // The read when Receive opens.
    actions.length = 0;

    expect(qrValues()).toEqual([]);
    expect(text()).toContain('Could not load your private address.');
    expect(text()).not.toContain('Private transfers are not available for this wallet.');
    expect(buttonTitles()).toEqual(['Retry']);

    await press('Retry');

    expect(actions.map((action) => action.type)).toEqual([types.WALLET_REFRESH_SHARED_ADDRESS]);
  });

  test('offers no retry while the wallet loads', async () => {
    const { text, buttonTitles } = await render({
      walletReady: false,
      receive: receive(SHIELDED_RECEIVE_STATUS.UNAVAILABLE, { reason: RECEIVE_REASON_ERROR }),
      shared: null,
    });

    expect(text()).toContain('Could not load your private address.');
    expect(buttonTitles()).toEqual([]);
  });

  test.each([
    SHIELDED_RECEIVE_STATUS.LOADING,
    SHIELDED_RECEIVE_STATUS.IDLE,
    SHIELDED_RECEIVE_STATUS.LOCKED,
    SHIELDED_RECEIVE_STATUS.UNAVAILABLE,
  ])('never falls back to the legacy address while the new one is %s', async (status) => {
    // A legacy shared address from before the shielded UI turned on, which the next read drops.
    const { text, qrValues } = await render({ receive: receive(status), shared: LEGACY_ADDRESS });

    expect(qrValues()).toEqual([]);
    expect(text()).not.toContain(LEGACY_ADDRESS);
  });
});
