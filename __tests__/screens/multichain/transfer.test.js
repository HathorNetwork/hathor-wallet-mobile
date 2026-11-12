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
import { multichainTransfersSet, multichainTransferUpdate, types } from '../../../src/actions';
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
import { NEXT_STATUS, OPERATION_STATUS, TRANSFER_STATUS } from '../../../src/multichain/state';
import { TransfersOnTheirWay } from '../../../src/components/Multichain/TransfersOnTheirWay';
import { fakePeerAddress } from '../../multichain/fakes/fakeAddress';
import { FAKE_NETWORK } from '../../multichain/fakes/sideChain';
/* eslint-enable import/first */

const NETWORK = FAKE_NETWORK;
const OWN_ADDRESS = fakePeerAddress('cd34');
const NEXT_ADDRESS = fakePeerAddress('ab12');
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

// `nativeToken` is what the fullnode reports; none until its version data is read.
function makeStore({ connected = true, nativeToken } = {}) {
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
    serverInfo: { decimal_places: 2, native_token: nativeToken },
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

  // A navigation that records the screen's beforeRemove listener, to try leaving the screen.
  const holdableNavigation = () => {
    const listeners = {};
    return {
      navigate: jest.fn(),
      goBack: jest.fn(),
      setOptions: jest.fn(),
      addListener: jest.fn((event, listener) => {
        listeners[event] = listener;
        return jest.fn();
      }),
      // Whether leaving now would be stopped.
      held: () => {
        const preventDefault = jest.fn();
        listeners.beforeRemove?.({ preventDefault });
        return preventDefault.mock.calls.length > 0;
      },
    };
  };

  test('confirms with the PIN, and ends with Done', async () => {
    const navigation = holdableNavigation();
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

  test('stays while the transfer is sent, and keeps it when it ends without an answer', async () => {
    const navigation = holdableNavigation();
    const { store } = makeStore();
    const renderer = await mount(
      store, (
        <ChainTransferConfirmScreen
          navigation={navigation}
          route={{ params: { amount: '10000', toAddress: OWN_ADDRESS } }}
        />
      )
    );
    expect(navigation.held()).toBe(false);
    await act(async () => {
      store.dispatch(multichainTransferUpdate({ status: OPERATION_STATUS.SENDING }));
    });
    expect(navigation.held()).toBe(true);
    expect(navigation.setOptions).toHaveBeenLastCalledWith({ gestureEnabled: false });

    await act(async () => {
      store.dispatch(multichainTransferUpdate({
        status: OPERATION_STATUS.UNCONFIRMED,
        error: 'not yet',
        uncertainId: 'transfer-1',
      }));
    });
    expect(navigation.held()).toBe(false);
    expect(renderer.root.findByType(FeedbackModal).props.text).toBe('not yet');
    expect(button(renderer, 'Confirm and send').props.disabled).toBe(true);
    // Leaving doesn't drop it: the next transfer settles it first.
    await act(async () => { renderer.unmount(); });
    expect(store.getState().multichain.transfer).toMatchObject({
      status: OPERATION_STATUS.UNCONFIRMED,
      uncertainId: 'transfer-1',
    });
  });

  test("names Hathor Network's native token by the symbol the fullnode reports", async () => {
    const { store } = makeStore({ nativeToken: { name: 'Test Native', symbol: 'TNT' } });
    const params = { amount: '10000', toAddress: OWN_ADDRESS };
    const form = await mount(
      store, (
        <ChainTransferScreen
          navigation={{ navigate: jest.fn(), goBack: jest.fn() }}
          route={{ params }}
        />
      )
    );
    const formText = textOf(form);
    expect(formText).toEqual(expect.arrayContaining([
      'TNT · 1,250.00 TNT available',
      'TNT',
      '99.90 TNT',
      '0.10 TNT',
    ]));
    expect(formText.join(' ')).not.toContain('HTR');
    await act(async () => { form.unmount(); });

    const confirm = await mount(
      store,
      <ChainTransferConfirmScreen navigation={holdableNavigation()} route={{ params }} />,
    );
    expect(textOf(confirm)).toContain('100.00 TNT');
    expect(textOf(confirm).join(' ')).not.toContain('HTR');
    await act(async () => {
      store.dispatch(multichainTransferUpdate({ status: OPERATION_STATUS.DONE }));
    });
    expect(confirm.root.findByType(FeedbackModal).props.text)
      .toBe('Your TNT will arrive on Hathor Next in about 2 minutes.');
  });
});

describe('transfers on their way, where HTR shows on Hathor Network alone', () => {
  const record = (fields) => ({
    id: 'transfer-1',
    from: 'hathor',
    to: 'hathor-next',
    hathorTokenId: '00',
    nextTokenId: 'aa'.repeat(32),
    amount: '700',
    receiveAmount: '700',
    bridgeFee: '0',
    networkFee: '1',
    toAddress: OWN_ADDRESS,
    toOwn: true,
    sentAt: 1000,
    arriveAt: 2000,
    sourceTxId: 'ee'.repeat(32),
    debitedOnSource: true,
    ...fields,
  });

  test('say where each transfer stands, and which failed', async () => {
    const { store } = makeStore();
    store.dispatch(multichainTransfersSet([
      record({
        status: TRANSFER_STATUS.PENDING,
        progress: { stage: 'confirming', confirmations: 5, needed: 21 },
      }),
      record({ id: 'transfer-2', status: TRANSFER_STATUS.FAILED, debitedOnSource: false }),
      record({ id: 'transfer-3', status: TRANSFER_STATUS.ARRIVED }),
    ]));
    const renderer = await mount(store, <TransfersOnTheirWay token={{ uid: '00', symbol: 'HTR' }} />);
    const text = textOf(renderer);
    expect(text).toContain('Confirming 5 of 21 on Hathor Network');
    expect(text).toContain("Didn't go through: nothing moved");
    // An arrived transfer is in the history already.
    expect(text.filter((line) => line === 'Moved to Hathor Next')).toHaveLength(2);
  });

  test('show nothing without the side chain', async () => {
    const { store } = makeStore({ connected: false });
    store.dispatch(multichainTransfersSet([record({ status: TRANSFER_STATUS.PENDING })]));
    const renderer = await mount(store, <TransfersOnTheirWay token={{ uid: '00', symbol: 'HTR' }} />);
    expect(renderer.toJSON()).toBeNull();
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
