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
const PUBLIC_ADDRESS = 'Wa9Q77VagNbzfecxW6g56jBuetkgEYyxoh';
const PRIVATE_ADDRESS = 'K3KokZRo7DyNRRiyijpsVix2VADrd4HeA8vWLR5itAj81BVC4Vv7xoXbrYyKYwsLMWhefXqXKgJvC6HcVkDuJ7AJ7qUMS7fVc';
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
 * testnet, on the fullnode facade, with a ready provider.
 */
async function render({
  flag = true,
  receive = null,
  addressMode = ADDRESS_MODE.MULTI,
  walletReady = true,
} = {}) {
  const actions = [];
  const recordActions = () => (next) => (action) => {
    actions.push(action);
    return next(action);
  };
  const store = createStore(reducer, applyMiddleware(recordActions));
  store.dispatch(setFeatureToggles({
    ...FEATURE_TOGGLE_DEFAULTS,
    [SHIELDED_OUTPUTS_FEATURE_TOGGLE]: flag,
  }));
  store.dispatch(setFullNodeNetworkName(FULL_NETWORK_SHIELDED_TESTNET));
  store.dispatch(shieldedProviderUpdate({ status: SHIELDED_PROVIDER_STATUS.READY }));
  store.dispatch(sharedAddressUpdate(PUBLIC_ADDRESS, 0));
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
  const openTab = (name) => act(async () => {
    renderer.root.find((node) => node.props.optionValue === name).props.onTap();
  });
  const press = (title) => act(async () => {
    renderer.root.find(
      (node) => node.props.title === title && typeof node.props.onPress === 'function',
    ).props.onPress();
  });
  return {
    store, actions, navigation, text, qrValues, buttonTitles, tabs, openTab, press,
  };
}

const receive = (status, fields = {}) => ({
  status, address: null, index: null, reason: null, ...fields,
});
const READY_RECEIVE = receive(SHIELDED_RECEIVE_STATUS.READY, {
  address: PRIVATE_ADDRESS,
  index: 0,
});

describe('ReceiveMyAddress', () => {
  test('shows the public address alone while the shielded UI is off', async () => {
    const { tabs, qrValues, buttonTitles } = await render({ flag: false });

    expect(tabs()).toEqual([]);
    expect(qrValues()).toEqual([`hathor:${PUBLIC_ADDRESS}`]);
    expect(buttonTitles()).toEqual(['New address', 'Share']);
  });

  test('offers Public and Private, and opens on Public', async () => {
    const { tabs, qrValues, buttonTitles } = await render({ receive: READY_RECEIVE });

    expect(tabs()).toEqual(['Public', 'Private']);
    expect(qrValues()).toEqual([`hathor:${PUBLIC_ADDRESS}`]);
    expect(buttonTitles()).toEqual(['New address', 'Share']);
  });

  test('hides New address on Public in single-address mode', async () => {
    const { buttonTitles } = await render({
      receive: READY_RECEIVE,
      addressMode: ADDRESS_MODE.SINGLE,
    });

    expect(buttonTitles()).toEqual(['Share']);
  });

  test('shows the private address on Private, with no new address', async () => {
    const share = jest.spyOn(Share, 'share').mockResolvedValue({});
    const { openTab, qrValues, buttonTitles, text, press } = await render({
      receive: READY_RECEIVE,
    });

    await openTab('Private');

    expect(qrValues()).toEqual([`hathor:${PRIVATE_ADDRESS}`]);
    expect(text()).toContain(PRIVATE_ADDRESS);
    expect(text()).toContain('Only wallets that support private transfers can pay this address.');
    expect(buttonTitles()).toEqual(['Share']);

    await press('Share');
    expect(share).toHaveBeenCalledWith({
      message: `Here is my private address: ${PRIVATE_ADDRESS}`,
    });
  });

  test('goes back to the public address', async () => {
    const { openTab, qrValues } = await render({ receive: READY_RECEIVE });

    await openTab('Private');
    await openTab('Public');

    expect(qrValues()).toEqual([`hathor:${PUBLIC_ADDRESS}`]);
  });

  test('reads the private address again when Private opens on a ready wallet', async () => {
    const ready = await render({ receive: READY_RECEIVE });
    expect(ready.actions).toEqual([]);
    await ready.openTab('Private');
    expect(ready.actions.map((action) => action.type))
      .toEqual([types.WALLET_REFRESH_SHARED_ADDRESS]);
  });

  test('reads nothing while the wallet loads', async () => {
    const loading = await render({ walletReady: false });
    await loading.openTab('Private');
    expect(loading.actions).toEqual([]);
  });

  test('asks to unlock the private balance of a locked wallet', async () => {
    const view = await render({
      receive: receive(SHIELDED_RECEIVE_STATUS.LOCKED, { reason: 'wrong-pin' }),
    });
    const { openTab, text, qrValues, press } = view;

    await openTab('Private');

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
    const { openTab, text, qrValues, buttonTitles } = await render({
      receive: receive(SHIELDED_RECEIVE_STATUS.UNAVAILABLE, { reason }),
    });

    await openTab('Private');

    expect(qrValues()).toEqual([]);
    expect(buttonTitles()).toEqual([]);
    expect(text()).toContain('Private receiving is unavailable');
    expect(text()).toContain(explanation);
    expect(text()).not.toContain(PUBLIC_ADDRESS);
  });

  test('offers a retry when the private address could not be read', async () => {
    const { openTab, text, qrValues, buttonTitles, press, actions } = await render({
      receive: receive(SHIELDED_RECEIVE_STATUS.UNAVAILABLE, { reason: RECEIVE_REASON_ERROR }),
    });

    await openTab('Private');
    // The read when the tab opens.
    actions.length = 0;

    expect(qrValues()).toEqual([]);
    expect(text()).toContain('Could not load your private address.');
    expect(text()).not.toContain('Private transfers are not available for this wallet.');
    expect(text()).not.toContain(PUBLIC_ADDRESS);
    expect(buttonTitles()).toEqual(['Retry']);

    await press('Retry');

    expect(actions.map((action) => action.type)).toEqual([types.WALLET_REFRESH_SHARED_ADDRESS]);
  });

  test('offers no retry while the wallet loads', async () => {
    const { openTab, text, buttonTitles } = await render({
      walletReady: false,
      receive: receive(SHIELDED_RECEIVE_STATUS.UNAVAILABLE, { reason: RECEIVE_REASON_ERROR }),
    });

    await openTab('Private');

    expect(text()).toContain('Could not load your private address.');
    expect(buttonTitles()).toEqual([]);
  });

  test.each([
    SHIELDED_RECEIVE_STATUS.LOADING,
    SHIELDED_RECEIVE_STATUS.IDLE,
  ])('never falls back to the public address while it is %s', async (status) => {
    const { openTab, text, qrValues, buttonTitles } = await render({ receive: receive(status) });

    await openTab('Private');

    expect(qrValues()).toEqual([]);
    expect(buttonTitles()).toEqual([]);
    expect(text()).not.toContain(PUBLIC_ADDRESS);
  });
});
