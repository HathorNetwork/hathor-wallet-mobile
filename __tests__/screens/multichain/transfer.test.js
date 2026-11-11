/**
 * Copyright (c) Hathor Labs and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { jest, describe, test, expect, afterEach, beforeEach } from '@jest/globals';

jest.mock('@react-navigation/native', () => ({
  ...jest.requireActual('@react-navigation/native'),
  useNavigation: jest.fn(),
  useRoute: jest.fn(),
}));

jest.mock('../../../src/NavigationService', () => ({
  __esModule: true,
  default: { navigate: jest.fn(), resetToMain: jest.fn() },
}));

// A network the tests give a side chain, and the fake bridge for its quotes.
// eslint-disable-next-line global-require
jest.mock('../../../src/multichain/chains', () => require('../../multichain/fakes/chainsModule'));
// eslint-disable-next-line global-require
jest.mock('../../../src/multichain/bridge', () => require('../../multichain/fakes/bridgeModule'));

/* eslint-disable import/first */
import React from 'react';
import { Pressable, Text, TextInput } from 'react-native';
import { act, create } from 'react-test-renderer';
import { Provider } from 'react-redux';
import { legacy_createStore as createStore, applyMiddleware } from 'redux';
import { useNavigation, useRoute } from '@react-navigation/native';
import { reducer } from '../../../src/reducers/reducer';
import { multichainTransferUpdate, types } from '../../../src/actions';
import {
  FEATURE_TOGGLE_DEFAULTS,
  MULTICHAIN_FEATURE_TOGGLE,
  PRE_SETTINGS_TESTNET,
} from '../../../src/constants';
import { STORE } from '../../../src/store';
import ChainTransferScreen from '../../../src/screens/Multichain/ChainTransferScreen';
import ChainTransferConfirmScreen from '../../../src/screens/Multichain/ChainTransferConfirmScreen';
import { SendAddressInput } from '../../../src/screens/SendAddressInput';
import AmountTextInput from '../../../src/components/AmountTextInput';
import FeedbackModal from '../../../src/components/FeedbackModal';
import NewHathorButton from '../../../src/components/NewHathorButton';
import { PortalProvider } from '../../../src/components/Portal';
import { NEXT_STATUS, OPERATION_STATUS } from '../../../src/multichain/state';
import { FAKE_NETWORK } from '../../multichain/fakes/sideChain';
/* eslint-enable import/first */

const NETWORK = FAKE_NETWORK;
const OWN_ADDRESS = `samba:${'cd34'.repeat(32)}`;
const NEXT_ADDRESS = `samba:${'ab12'.repeat(32)}`;
const HATHOR_ADDRESS = 'Wa9Q77VagNbzfecxW6g56jBuetkgEYyxoh';

let mounted = null;

beforeEach(() => {
  jest.spyOn(STORE, 'isPasskeyWallet').mockReturnValue(false);
});

afterEach(async () => {
  if (mounted) {
    await act(async () => { mounted.unmount(); });
    mounted = null;
  }
  jest.restoreAllMocks();
});

function makeStore({ connected = true } = {}) {
  const initial = reducer(undefined, { type: '@@INIT' });
  const actions = [];
  const record = () => (nextFn) => (action) => {
    actions.push(action);
    return nextFn(action);
  };
  const store = createStore(reducer, {
    ...initial,
    networkSettings: PRE_SETTINGS_TESTNET,
    featureToggles: { ...FEATURE_TOGGLE_DEFAULTS, [MULTICHAIN_FEATURE_TOGGLE]: true },
    serverInfo: { decimal_places: 2 },
    fullNodeNetworkName: NETWORK,
    tokensBalance: { '00': { status: 'ready', data: { available: 125000n } } },
    multichain: {
      ...initial.multichain,
      connectedNetworks: connected ? { [NETWORK]: true } : {},
      next: { ...initial.multichain.next, status: NEXT_STATUS.READY, address: OWN_ADDRESS },
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
  .map((node) => [].concat(node.props.children).join(''))
  .filter(Boolean);

const addressInput = (renderer) => renderer.root.findAllByType(TextInput)
  .find((node) => node.props.placeholder === 'Paste or type a Hathor Next address');

const button = (renderer, title) => renderer.root.findAllByType(NewHathorButton)
  .find((node) => node.props.title === title);

describe('the transfer between chains', () => {
  test("says the other way isn't there yet when From and To are swapped", async () => {
    const renderer = await mount(
      makeStore().store,
      <ChainTransferScreen navigation={{ navigate: jest.fn(), goBack: jest.fn() }} />,
    );
    const swap = renderer.root.findAllByType(Pressable)
      .find((node) => node.props.accessibilityLabel === 'Swap From and To');
    await act(async () => { swap.props.onPress(); });
    expect(textOf(renderer)).toContain(
      "Transfers from Hathor Next to Hathor Network aren't available yet.",
    );
  });

  test('starts with the address and the amount Send handed it', async () => {
    const renderer = await mount(
      makeStore().store, (
        <ChainTransferScreen
          navigation={{ navigate: jest.fn(), goBack: jest.fn() }}
          route={{ params: { toAddress: NEXT_ADDRESS, amount: '3010' } }}
        />
      )
    );
    expect(addressInput(renderer).props.value).toBe(NEXT_ADDRESS);
    expect(renderer.root.findByType(AmountTextInput).props.value).toBe('30.10');
    expect(textOf(renderer)).toContain('30.00 HTR');
  });

  test("fills in the wallet's own address, and goes on with what to transfer", async () => {
    const navigation = { navigate: jest.fn(), goBack: jest.fn() };
    const { store } = makeStore();
    const renderer = await mount(store, <ChainTransferScreen navigation={navigation} />);
    expect(addressInput(renderer).props.value).toBe('');
    const useMine = renderer.root.findAllByType(Text)
      .find((node) => node.props.children === 'Use my Hathor Next address');
    await act(async () => { useMine.props.onPress(); });
    await act(async () => {
      renderer.root.findByType(AmountTextInput).props.onAmountUpdate('100', 10000n);
    });
    await act(async () => { button(renderer, 'Continue').props.onPress(); });
    expect(navigation.navigate).toHaveBeenCalledWith('ChainTransferConfirm', {
      from: 'hathor',
      to: 'hathor-next',
      tokenId: '00',
      amount: '10000',
      toAddress: OWN_ADDRESS,
    });
  });

  test('has its own words for a Hathor Network address', async () => {
    const renderer = await mount(
      makeStore().store,
      <ChainTransferScreen navigation={{ navigate: jest.fn(), goBack: jest.fn() }} />,
    );
    await act(async () => { addressInput(renderer).props.onChangeText(HATHOR_ADDRESS); });
    await act(async () => {
      renderer.root.findByType(AmountTextInput).props.onAmountUpdate('100', 10000n);
    });
    await act(async () => { button(renderer, 'Continue').props.onPress(); });
    expect(textOf(renderer)).toContain(
      'This is a Hathor Network address. Enter a Hathor Next address.',
    );
  });

  test('confirms with the PIN, and ends with Done', async () => {
    const navigation = { navigate: jest.fn(), goBack: jest.fn() };
    const { store, actions } = makeStore();
    const renderer = await mount(
      store, (
        <ChainTransferConfirmScreen
          navigation={navigation}
          route={{ params: {
            from: 'hathor',
            to: 'hathor-next',
            tokenId: '00',
            amount: '10000',
            toAddress: OWN_ADDRESS,
          } }}
        />
      )
    );
    await act(async () => { button(renderer, 'Confirm and send').props.onPress(); });
    const [, pinParams] = navigation.navigate.mock.calls.find(([route]) => route === 'PinScreen');
    await act(async () => { pinParams.cb('123456'); });
    expect(actions).toContainEqual({
      type: types.MULTICHAIN_TRANSFER_REQUESTED,
      payload: {
        from: 'hathor',
        to: 'hathor-next',
        tokenId: '00',
        amount: 10000n,
        toAddress: OWN_ADDRESS,
        pinCode: '123456',
      },
    });
    await act(async () => {
      store.dispatch(multichainTransferUpdate({ status: OPERATION_STATUS.DONE }));
    });
    const feedback = renderer.root.findByType(FeedbackModal);
    expect(feedback.props.text).toBe('Your HTR will arrive on Hathor Next in about 2 minutes.');
    expect(feedback.props.action.props.title).toBe('Done');
  });
});

describe("Send's way to the transfer", () => {
  beforeEach(() => {
    useRoute.mockReturnValue({ params: {} });
  });

  test('is a button at the bottom of the address step, with the side chain connected', async () => {
    const navigation = { navigate: jest.fn() };
    useNavigation.mockReturnValue(navigation);
    const renderer = await mount(makeStore().store, <SendAddressInput />);
    await act(async () => { button(renderer, 'Transfer between chains').props.onPress(); });
    expect(navigation.navigate).toHaveBeenCalledWith('ChainTransfer');
  });

  test('is not there without it', async () => {
    useNavigation.mockReturnValue({ navigate: jest.fn() });
    const renderer = await mount(makeStore({ connected: false }).store, <SendAddressInput />);
    expect(button(renderer, 'Transfer between chains')).toBeUndefined();
  });
});
