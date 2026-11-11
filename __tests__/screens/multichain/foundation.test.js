/**
 * Copyright (c) Hathor Labs and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { jest, describe, test, expect, afterEach, beforeEach } from '@jest/globals';

jest.mock('../../../src/NavigationService', () => ({
  __esModule: true,
  default: { navigate: jest.fn(), resetToMain: jest.fn() },
}));

// A network the tests give a side chain.
// eslint-disable-next-line global-require
jest.mock('../../../src/multichain/chains', () => require('../../multichain/fakes/chainsModule'));

/* eslint-disable import/first */
import React from 'react';
import { Switch, Text } from 'react-native';
import { act, create } from 'react-test-renderer';
import { Provider } from 'react-redux';
import { legacy_createStore as createStore, applyMiddleware } from 'redux';
import { reducer } from '../../../src/reducers/reducer';
import { types } from '../../../src/actions';
import {
  FEATURE_TOGGLE_DEFAULTS,
  MULTICHAIN_FEATURE_TOGGLE,
  NETWORK_SETTINGS_FEATURE_TOGGLE,
  PRE_SETTINGS_TESTNET,
} from '../../../src/constants';
import { STORE } from '../../../src/store';
import Settings from '../../../src/screens/Settings';
import OfflineBar from '../../../src/components/OfflineBar';
import FeedbackModal from '../../../src/components/FeedbackModal';
import { ListItem, ListMenu } from '../../../src/components/HathorList';
import { PortalProvider } from '../../../src/components/Portal';
import { ConnectFeedback } from '../../../src/components/Multichain/ConnectFeedback';
import { MultichainLoadScreen } from '../../../src/components/Multichain/MultichainLoadScreen';
import SimpleButton from '../../../src/components/SimpleButton';
import { CONNECT_STATUS, NEXT_STATUS } from '../../../src/multichain/state';
import { FAKE_NETWORK } from '../../multichain/fakes/sideChain';
/* eslint-enable import/first */

const NETWORK = FAKE_NETWORK;

let mounted = null;

afterEach(async () => {
  if (mounted) {
    await act(async () => { mounted.unmount(); });
    mounted = null;
  }
  jest.restoreAllMocks();
});

beforeEach(() => {
  jest.spyOn(STORE, 'isPasskeyWallet').mockReturnValue(false);
});

/**
 * A store on a network with a side chain, with the flag on unless asked otherwise.
 */
function makeStore({
  flag = true,
  network = NETWORK,
  connected = false,
  next = {},
  connect = {},
  isOnline = true,
} = {}) {
  const initial = reducer(undefined, { type: '@@INIT' });
  const actions = [];
  const record = () => (nextFn) => (action) => {
    actions.push(action);
    return nextFn(action);
  };
  const store = createStore(reducer, {
    ...initial,
    isOnline,
    networkSettings: PRE_SETTINGS_TESTNET,
    featureToggles: {
      ...FEATURE_TOGGLE_DEFAULTS,
      [MULTICHAIN_FEATURE_TOGGLE]: flag,
      [NETWORK_SETTINGS_FEATURE_TOGGLE]: true,
    },
    serverInfo: { decimal_places: 2 },
    fullNodeNetworkName: network,
    multichain: {
      ...initial.multichain,
      connectedNetworks: connected ? { [network]: true } : {},
      connect: { ...initial.multichain.connect, ...connect },
      next: { ...initial.multichain.next, status: NEXT_STATUS.READY, ...next },
    },
  }, applyMiddleware(record));
  return { store, actions };
}

async function mount(store, element) {
  let renderer;
  await act(async () => {
    renderer = create(
      <Provider store={store}><PortalProvider>{element}</PortalProvider></Provider>,
    );
  });
  mounted = renderer;
  return renderer;
}

const textOf = (renderer) => renderer.root.findAllByType(Text)
  .map((node) => node.props.children)
  .flat()
  .filter((child) => typeof child === 'string');

describe('Settings', () => {
  const titles = (renderer) => [
    ...renderer.root.findAllByType(ListMenu).map((node) => node.props.title),
    ...renderer.root.findAllByType(ListItem).map((node) => node.props.title),
  ];

  test('offers "Connect to side chain" on a network with a side chain', async () => {
    const navigation = { navigate: jest.fn() };
    const renderer = await mount(makeStore().store, <Settings navigation={navigation} />);
    expect(titles(renderer)).toContain('Connect to side chain');
  });

  test('changes nothing with the flag off, or on mainnet', async () => {
    const navigation = { navigate: jest.fn() };
    const off = await mount(makeStore({ flag: false }).store, <Settings navigation={navigation} />);
    expect(titles(off)).not.toContain('Connect to side chain');
    await act(async () => { mounted.unmount(); });
    const mainnet = await mount(
      makeStore({ network: 'mainnet' }).store,
      <Settings navigation={navigation} />,
    );
    expect(titles(mainnet)).not.toContain('Connect to side chain');
  });

  test('asks for the PIN when the keys need it, and turns the setting on with it', async () => {
    const { store, actions } = makeStore();
    const navigation = { navigate: jest.fn() };
    const renderer = await mount(store, <Settings navigation={navigation} />);
    await act(async () => { renderer.root.findByType(Switch).props.onValueChange(true); });
    expect(navigation.navigate).toHaveBeenCalledWith('PinScreen', expect.any(Object));
    const changed = () => actions.filter(
      (a) => a.type === types.MULTICHAIN_CONNECT_SETTING_CHANGED,
    );
    expect(changed()).toHaveLength(0);
    await act(async () => { navigation.navigate.mock.calls[0][1].cb('123456'); });
    expect(changed()).toEqual([{
      type: types.MULTICHAIN_CONNECT_SETTING_CHANGED,
      payload: { connected: true, pinCode: '123456' },
    }]);
  });

  test('turns it on at once when the keys are in memory', async () => {
    const { store, actions } = makeStore({ next: { keysReady: true } });
    const navigation = { navigate: jest.fn() };
    const renderer = await mount(store, <Settings navigation={navigation} />);
    await act(async () => { renderer.root.findByType(Switch).props.onValueChange(true); });
    expect(navigation.navigate).not.toHaveBeenCalled();
    expect(actions).toContainEqual({
      type: types.MULTICHAIN_CONNECT_SETTING_CHANGED,
      payload: { connected: true, pinCode: undefined },
    });
  });

  test('keeps every Hathor Network row with the side chain connected', async () => {
    const renderer = await mount(
      makeStore({ connected: true }).store,
      <Settings navigation={{ navigate: jest.fn() }} />,
    );
    expect(titles(renderer)).toEqual(expect.arrayContaining([
      'Register a token', 'Create a new token', 'Network Settings', 'Connect to side chain',
    ]));
    expect(renderer.root.findByType(Switch).props.value).toBe(true);
  });
});

describe('turning the side chain on', () => {
  test('blocks the screen while it connects', async () => {
    const { store } = makeStore({ connect: { status: CONNECT_STATUS.CONNECTING } });
    const renderer = await mount(store, <ConnectFeedback />);
    expect(renderer.root.findByType(FeedbackModal).props.text).toBe('Connecting to Hathor Next…');
  });

  test('says why it failed, and is dismissed', async () => {
    const { store, actions } = makeStore({
      connect: { status: CONNECT_STATUS.FAILED, error: "Couldn't connect to Hathor Next." },
    });
    const renderer = await mount(store, <ConnectFeedback />);
    const modal = renderer.root.findByType(FeedbackModal);
    expect(modal.props.text).toBe("Couldn't connect to Hathor Next.");
    await act(async () => { modal.props.onDismiss(); });
    expect(actions).toContainEqual({
      type: types.MULTICHAIN_CONNECT_UPDATE,
      payload: { status: CONNECT_STATUS.IDLE, error: null },
    });
  });
});

describe('the app waiting for Hathor Next', () => {
  test('says it is loading Hathor Next', async () => {
    const { store } = makeStore({ connected: true, next: { status: NEXT_STATUS.CONNECTING } });
    const renderer = await mount(store, <MultichainLoadScreen />);
    expect(textOf(renderer)).toContain('Loading Hathor Next…');
  });

  test('offers only Try again when it fails', async () => {
    const { store, actions } = makeStore({
      connected: true,
      next: { status: NEXT_STATUS.FAILED, error: "Couldn't connect to Hathor Next.", keysReady: true },
    });
    const renderer = await mount(store, <MultichainLoadScreen />);
    expect(textOf(renderer)).toContain("Couldn't connect to Hathor Next.");
    const buttons = renderer.root.findAllByType(SimpleButton);
    expect(buttons.map((node) => node.props.title)).toEqual(['Try again']);
    await act(async () => { buttons[0].props.onPress(); });
    expect(actions).toContainEqual({
      type: types.MULTICHAIN_LOAD_REQUESTED,
      payload: { pinCode: undefined },
    });
  });

  test("locks the app for the PIN when a seed wallet's keys are missing", async () => {
    const { store, actions } = makeStore({
      connected: true,
      next: { status: NEXT_STATUS.FAILED, error: 'x', keysReady: false },
    });
    const renderer = await mount(store, <MultichainLoadScreen />);
    await act(async () => { renderer.root.findByType(SimpleButton).props.onPress(); });
    expect(actions.map((a) => a.type)).toContain(types.SET_LOCK_SCREEN);
    expect(actions.map((a) => a.type)).not.toContain(types.MULTICHAIN_LOAD_REQUESTED);
  });
});

describe('the offline bar', () => {
  test('says when Hathor Next lost its connection', async () => {
    const { store } = makeStore({ connected: true, next: { online: false } });
    const renderer = await mount(store, <OfflineBar />);
    expect(textOf(renderer)).toEqual(['No connection to Hathor Next']);
  });

  test("keeps Hathor Network's words when the wallet is offline", async () => {
    const { store } = makeStore({ connected: true, isOnline: false, next: { online: false } });
    const renderer = await mount(store, <OfflineBar />);
    expect(textOf(renderer)).toEqual(['No internet connection']);
  });

  test('shows nothing while both are online', async () => {
    const { store } = makeStore({ connected: true });
    const renderer = await mount(store, <OfflineBar />);
    expect(textOf(renderer)).toEqual([]);
  });
});
