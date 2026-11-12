/**
 * Copyright (c) Hathor Labs and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import {
  jest, describe, test, expect, afterEach,
} from '@jest/globals';

const mockNavigation = { navigate: jest.fn(), goBack: jest.fn() };
jest.mock('../../src/hooks/navigation', () => ({
  useNavigation: () => mockNavigation,
}));
const mockPins = {
  next: {
    network_id: 1003,
    native_token: 'aa'.repeat(32),
    service_view_pub: 'bb'.repeat(32),
    wire_format: 'v3',
    genesis_ms: 1794240267000,
    epoch_ms: 500,
  },
  transfer: null,
};
jest.mock('../../src/multichain/next/backendApi', () => ({
  createBackendApi: () => ({ getConfig: async () => mockPins }),
}));

// A network the tests give a side chain.
// eslint-disable-next-line global-require
jest.mock('../../src/multichain/chains', () => require('../multichain/fakes/chainsModule'));

/* eslint-disable import/first */
import React from 'react';
import { act, create } from 'react-test-renderer';
import { Provider } from 'react-redux';
import { applyMiddleware, legacy_createStore as createStore } from 'redux';
import { reducer } from '../../src/reducers/reducer';
import {
  multichainConnectedNetworksSet,
  multichainDevBackendSet,
  setFeatureToggles,
  setFullNodeNetworkName,
  types,
} from '../../src/actions';
import { MULTICHAIN_DEV_BACKEND_FEATURE_TOGGLE, MULTICHAIN_FEATURE_TOGGLE } from '../../src/constants';
import { STORE } from '../../src/store';
import { DevBackendSettings } from '../../src/components/Multichain/DevBackendSettings';
import { FAKE_NETWORK } from '../multichain/fakes/sideChain';
/* eslint-enable import/first */

const URL = 'https://wallet-backend.devnet-alpha.samba.hathor.network';
const PIN = '123456';

let mounted = null;

afterEach(async () => {
  if (mounted) {
    await act(async () => { mounted.unmount(); });
    mounted = null;
  }
  jest.restoreAllMocks();
  jest.clearAllMocks();
});

async function render({ backend = null, passkey = false } = {}) {
  jest.spyOn(STORE, 'isPasskeyWallet').mockReturnValue(passkey);
  const sets = [];
  const record = () => (next) => (action) => {
    if (action.type === types.MULTICHAIN_DEV_BACKEND_SET) sets.push(action);
    return next(action);
  };
  const store = createStore(reducer, applyMiddleware(record));
  store.dispatch(setFeatureToggles({
    [MULTICHAIN_FEATURE_TOGGLE]: true,
    [MULTICHAIN_DEV_BACKEND_FEATURE_TOGGLE]: true,
  }));
  store.dispatch(setFullNodeNetworkName(FAKE_NETWORK));
  store.dispatch(multichainConnectedNetworksSet({ [FAKE_NETWORK]: true }));
  if (backend) {
    store.dispatch(multichainDevBackendSet(backend, { persist: false }));
  }
  sets.length = 0;
  await act(async () => {
    mounted = create(<Provider store={store}><DevBackendSettings /></Provider>);
  });
  const press = async (title) => {
    const [button] = mounted.root.findAll((node) => node.props.title === title);
    await act(async () => { await button.props.onPress(); });
  };
  const type = async (text) => {
    const [input] = mounted.root.findAll(
      (node) => node.props.onChangeText && node.props.value !== undefined,
    );
    await act(async () => { input.props.onChangeText(text); });
  };
  return { sets, press, type };
}

const pinScreen = () => {
  const call = mockNavigation.navigate.mock.calls.find(([name]) => name === 'PinScreen');
  return call ? call[1] : null;
};

describe('switching the backend for local testing', () => {
  test('asks for the PIN first, and switches with it, so Hathor Next loads at once', async () => {
    const { sets, press, type } = await render();
    await type(URL);
    await press('Use this backend');
    expect(sets).toEqual([]);
    const params = pinScreen();
    expect(params).toMatchObject({ canCancel: true });
    await act(async () => { params.cb(PIN); });
    expect(sets).toEqual([expect.objectContaining({
      payload: { url: URL, pins: mockPins },
      meta: { persist: true, pinCode: PIN },
    })]);
  });

  test('asks for it to stop using one too', async () => {
    const { sets, press } = await render({ backend: { url: URL, pins: mockPins } });
    await press('Stop using this backend');
    expect(sets).toEqual([]);
    await act(async () => { pinScreen().cb(PIN); });
    expect(sets).toEqual([expect.objectContaining({
      payload: null,
      meta: { persist: true, pinCode: PIN },
    })]);
  });

  test("leaves a passkey wallet's keys to its ceremony, with no PIN screen", async () => {
    const { sets, press, type } = await render({ passkey: true });
    await type(URL);
    await press('Use this backend');
    expect(pinScreen()).toBeNull();
    expect(sets).toEqual([expect.objectContaining({ payload: { url: URL, pins: mockPins } })]);
  });
});
