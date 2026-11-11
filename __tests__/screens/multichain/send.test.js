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

// The camera can't run here: the scanner's reader is a stand-in, whose onSuccess the tests call.
jest.mock('../../../src/components/QRCodeReader', () => {
  const QRCodeReaderStandIn = () => null;
  return QRCodeReaderStandIn;
});

jest.mock('../../../src/NavigationService', () => ({
  __esModule: true,
  default: { navigate: jest.fn(), resetToMain: jest.fn() },
}));

// A network the tests give a side chain, and the fake bridge for the transfer's quotes.
// eslint-disable-next-line global-require
jest.mock('../../../src/multichain/chains', () => require('../../multichain/fakes/chainsModule'));
// eslint-disable-next-line global-require
jest.mock('../../../src/multichain/bridge', () => require('../../multichain/fakes/bridgeModule'));

/* eslint-disable import/first */
import React from 'react';
import { Text, TextInput } from 'react-native';
import { act, create } from 'react-test-renderer';
import { Provider } from 'react-redux';
import { legacy_createStore as createStore, applyMiddleware } from 'redux';
import { useNavigation, useRoute } from '@react-navigation/native';
import { reducer } from '../../../src/reducers/reducer';
import { multichainNextSendUpdate, types } from '../../../src/actions';
import {
  FEATURE_TOGGLE_DEFAULTS,
  MULTICHAIN_FEATURE_TOGGLE,
  PRE_SETTINGS_TESTNET,
} from '../../../src/constants';
import { STORE } from '../../../src/store';
import * as passkeySigner from '../../../src/passkey/passkeySigner';
import { SendAddressInput } from '../../../src/screens/SendAddressInput';
import SendAmountInput from '../../../src/screens/SendAmountInput';
import NextSendAmountInput from '../../../src/screens/Multichain/NextSendAmountInput';
import NextSendConfirmScreen from '../../../src/screens/Multichain/NextSendConfirmScreen';
import UnifiedQRScanner from '../../../src/screens/UnifiedQRScanner';
import AmountTextInput from '../../../src/components/AmountTextInput';
import FeedbackModal from '../../../src/components/FeedbackModal';
import NewHathorButton from '../../../src/components/NewHathorButton';
import QRCodeReader from '../../../src/components/QRCodeReader';
import { PortalProvider } from '../../../src/components/Portal';
import { ChainTag } from '../../../src/components/Multichain/ChainTag';
import { NEXT_STATUS, OPERATION_STATUS } from '../../../src/multichain/state';
import { fakePeerAddress } from '../../multichain/fakes/fakeAddress';
import { FAKE_NETWORK } from '../../multichain/fakes/sideChain';
/* eslint-enable import/first */

const NETWORK = FAKE_NETWORK;
const OWN_ADDRESS = fakePeerAddress('cd34');
const NEXT_ADDRESS = fakePeerAddress('ab12');
const HATHOR_ADDRESS = 'Wa9Q77VagNbzfecxW6g56jBuetkgEYyxoh';
const HTR = { uid: '00', name: 'Hathor', symbol: 'HTR' };

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

/**
 * 1,000.00 HTR on Hathor Network unless asked otherwise, and 3.00 on Hathor Next.
 */
function makeStore({ connected = true, hathorHtr = 100000n, next = {} } = {}) {
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
    tokens: { '00': HTR },
    selectedToken: HTR,
    tokensBalance: { '00': { status: 'ready', data: { available: hathorHtr, locked: 0n } } },
    multichain: {
      ...initial.multichain,
      connectedNetworks: connected ? { [NETWORK]: true } : {},
      next: {
        ...initial.multichain.next,
        status: NEXT_STATUS.READY,
        online: true,
        address: OWN_ADDRESS,
        sendFee: 5000000n,
        tokens: { '00': { id: '00', name: 'Hathor', symbol: 'HTR' } },
        balances: { '00': { status: 'ready', data: { available: 300000000n } } },
        ...next,
      },
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

const button = (renderer, title) => renderer.root.findAllByType(NewHathorButton)
  .find((node) => node.props.title === title);

describe('the Send address step', () => {
  async function typeAddress(address, { connected = true } = {}) {
    const navigation = { navigate: jest.fn() };
    useNavigation.mockReturnValue(navigation);
    useRoute.mockReturnValue({ params: {} });
    const renderer = await mount(makeStore({ connected }).store, <SendAddressInput />);
    await act(async () => { renderer.root.findByType(TextInput).props.onChangeText(address); });
    return { renderer, navigation };
  }

  test('sends on Hathor Next to a Hathor Next address, and says so', async () => {
    const { renderer, navigation } = await typeAddress(NEXT_ADDRESS);
    expect(renderer.root.findByType(ChainTag).props.chain).toBe('hathor-next');
    await act(async () => { button(renderer, 'Next').props.onPress(); });
    expect(navigation.navigate).toHaveBeenCalledWith('NextSendAmountInput', { address: NEXT_ADDRESS });
  });

  test('sends on Hathor Network to a Hathor Network address', async () => {
    const { renderer, navigation } = await typeAddress(HATHOR_ADDRESS);
    expect(renderer.root.findByType(ChainTag).props.chain).toBe('hathor');
    await act(async () => { button(renderer, 'Next').props.onPress(); });
    expect(navigation.navigate).toHaveBeenCalledWith('SendAmountInput', { address: HATHOR_ADDRESS });
  });

  test.each([true, false])(
    'refuses the transfer address at once, and says to transfer instead (connected: %s)',
    async (connected) => {
      const { renderer, navigation } = await typeAddress('WScTqhLsBQnz3HMdQqh66JBgWqb255XffL', { connected });
      expect(textOf(renderer).join(' ')).toContain('anything sent to it directly is lost');
      expect(button(renderer, 'Next').props.disabled).toBe(true);
      expect(navigation.navigate).not.toHaveBeenCalled();
    },
  );

  test('takes no Hathor Next address before the side chain is connected', async () => {
    const { renderer } = await typeAddress(NEXT_ADDRESS, { connected: false });
    expect(button(renderer, 'Next').props.disabled).toBe(true);
    expect(renderer.root.findAllByType(ChainTag)).toHaveLength(0);
  });
});

describe('a send short on Hathor Next', () => {
  async function amountStep(amount, storeOptions) {
    const navigation = { navigate: jest.fn(), goBack: jest.fn() };
    useNavigation.mockReturnValue(navigation);
    useRoute.mockReturnValue({ params: { address: NEXT_ADDRESS } });
    const renderer = await mount(makeStore(storeOptions).store, <NextSendAmountInput />);
    await act(async () => {
      renderer.root.findByType(AmountTextInput).props.onAmountUpdate('x', amount);
    });
    await act(async () => { button(renderer, 'Next').props.onPress(); });
    return { renderer, navigation };
  }

  test('offers to send from Hathor Network, filled in', async () => {
    const { renderer, navigation } = await amountStep(3000000000n);
    expect(textOf(renderer)).toContain(
      'You have 3.00 HTR on Hathor Next. Send from Hathor Network instead? It arrives in about 2 minutes.',
    );
    await act(async () => { button(renderer, 'Transfer between chains').props.onPress(); });
    expect(navigation.navigate).toHaveBeenCalledWith('ChainTransfer', {
      toAddress: NEXT_ADDRESS,
      amount: '3010',
    });
  });

  test('says only that funds are short when no chain has them', async () => {
    const { renderer } = await amountStep(3000000000n, { hathorHtr: 100n });
    expect(textOf(renderer)).toContain('Insufficient funds');
    expect(button(renderer, 'Transfer between chains')).toBeUndefined();
  });
});

describe('a send short on Hathor Network', () => {
  test("says Hathor Next has it, and that the transfer from there isn't available yet", async () => {
    useNavigation.mockReturnValue({
      navigate: jest.fn(), goBack: jest.fn(), addListener: jest.fn(() => jest.fn()),
    });
    useRoute.mockReturnValue({ params: { address: HATHOR_ADDRESS } });
    const renderer = await mount(makeStore({ hathorHtr: 200n }).store, <SendAmountInput />);
    await act(async () => {
      renderer.root.findByType(AmountTextInput).props.onAmountUpdate('3.00', 300n);
    });
    await act(async () => { button(renderer, 'Next').props.onPress(); });
    expect(textOf(renderer)).toContain(
      "You have 2.00 HTR on Hathor Network. Transfers from Hathor Next to Hathor Network aren't available yet.",
    );
  });
});

describe('the Hathor Next send confirmation (sign-once)', () => {
  // `earlier` is another draft's payment, already in the state when the screen opens.
  async function renderConfirm({ next = {}, earlier = null } = {}) {
    STORE.isPasskeyWallet.mockReturnValue(true);
    const ceremony = jest.spyOn(passkeySigner, 'withPasskeyWords')
      .mockImplementation(async (fn) => fn('words'));
    const listeners = {};
    const navigation = {
      navigate: jest.fn(),
      goBack: jest.fn(),
      popToTop: jest.fn(),
      setOptions: jest.fn(),
      addListener: jest.fn((event, listener) => {
        listeners[event] = listener;
        return jest.fn();
      }),
    };
    // Whether leaving now would be stopped.
    const held = () => {
      const preventDefault = jest.fn();
      listeners.beforeRemove?.({ preventDefault });
      return preventDefault.mock.calls.length > 0;
    };
    useNavigation.mockReturnValue(navigation);
    useRoute.mockReturnValue({ params: { address: NEXT_ADDRESS, amount: '100000000' } });
    const env = makeStore({ next });
    if (earlier) {
      env.store.dispatch(multichainNextSendUpdate(earlier));
    }
    const renderer = await mount(env.store, <NextSendConfirmScreen />);
    const sendButton = () => button(renderer, 'Send');
    const sends = () => env.actions.filter((a) => a.type === types.MULTICHAIN_NEXT_SEND_REQUESTED);
    return { ...env, renderer, navigation, held, sendButton, sends, ceremony };
  }

  test('sends once, and Send never turns back on, whatever the outcome', async () => {
    const { store, renderer, sendButton, sends } = await renderConfirm();
    await act(async () => { sendButton().props.onPress(); });
    expect(sends()).toHaveLength(1);
    expect(sendButton().props.disabled).toBe(true);
    expect(textOf(renderer)).toContain('1.05 HTR');

    const { draftId } = sends()[0].payload;
    await act(async () => {
      store.dispatch(multichainNextSendUpdate({
        status: OPERATION_STATUS.FAILED, draftId, reason: 'no',
      }));
    });
    expect(sendButton().props.disabled).toBe(true);
    await act(async () => { sendButton().props.onPress(); });
    expect(sends()).toHaveLength(1);
  });

  test("shows the network's words when the payment is turned down", async () => {
    const { store, renderer, sendButton, sends } = await renderConfirm();
    await act(async () => { sendButton().props.onPress(); });
    const { draftId } = sends()[0].payload;
    await act(async () => {
      store.dispatch(multichainNextSendUpdate({
        status: OPERATION_STATUS.FAILED, draftId, reason: 'fee too low',
      }));
    });
    const feedback = renderer.root.findByType(FeedbackModal);
    expect(feedback.props.text).toContain('The network turned it down');
    expect(feedback.props.text).toContain('The network said: fee too low');
  });

  test('a passkey wallet authorizes the payment with its passkey before anything is sent', async () => {
    const { sendButton, sends, ceremony } = await renderConfirm();
    await act(async () => { sendButton().props.onPress(); });
    expect(ceremony).toHaveBeenCalledTimes(1);
    expect(sends()).toHaveLength(1);
  });

  test('a dismissed passkey sends nothing, and Send stays on', async () => {
    const { sendButton, sends, ceremony } = await renderConfirm();
    ceremony.mockRejectedValue(new passkeySigner.PasskeyCancelledError());
    await act(async () => { sendButton().props.onPress(); });
    expect(sends()).toHaveLength(0);
    expect(sendButton().props.disabled).toBe(false);
  });

  test('Send waits while Hathor Next is offline or syncing', async () => {
    const offline = await renderConfirm({ next: { online: false } });
    expect(offline.sendButton().props.disabled).toBe(true);
    await act(async () => { mounted.unmount(); });
    const syncing = await renderConfirm({ next: { sweeping: true } });
    expect(syncing.sendButton().props.disabled).toBe(true);
    await act(async () => { syncing.sendButton().props.onPress(); });
    expect(syncing.sends()).toHaveLength(0);
  });

  test('stays while the payment is on its way, and keeps it when the screen goes', async () => {
    const { store, renderer, navigation, held, sendButton, sends } = await renderConfirm();
    expect(held()).toBe(false);
    await act(async () => { sendButton().props.onPress(); });
    const { draftId } = sends()[0].payload;
    await act(async () => {
      store.dispatch(multichainNextSendUpdate({ status: OPERATION_STATUS.SENDING, draftId }));
    });
    expect(held()).toBe(true);
    expect(navigation.setOptions).toHaveBeenLastCalledWith({ gestureEnabled: false });
    await act(async () => {
      store.dispatch(multichainNextSendUpdate({ status: 'pending', sendId: 'send-1' }));
    });
    expect(held()).toBe(true);

    // Gone anyway (Hathor Next's own reset is what drops a payment): its outcome is still to come.
    await act(async () => { renderer.unmount(); });
    mounted = null;
    expect(store.getState().multichain.send).toMatchObject({ status: 'pending', draftId });
  });

  test('lets the screen go once the outcome shows', async () => {
    const { store, held, sendButton, sends } = await renderConfirm();
    await act(async () => { sendButton().props.onPress(); });
    const { draftId } = sends()[0].payload;
    await act(async () => {
      store.dispatch(multichainNextSendUpdate({ status: 'pending', draftId }));
    });
    expect(held()).toBe(true);
    await act(async () => {
      store.dispatch(multichainNextSendUpdate({ status: OPERATION_STATUS.RECORDED }));
    });
    expect(held()).toBe(false);
  });

  test('Send waits for an earlier payment still on its way', async () => {
    const { store, renderer, sendButton, sends } = await renderConfirm({
      earlier: { status: 'pending', draftId: 'earlier-draft', sendId: 'send-1' },
    });
    expect(sendButton().props.disabled).toBe(true);
    expect(textOf(renderer)).toContain(
      'An earlier payment is still on its way. You can send once it settles.',
    );
    await act(async () => { sendButton().props.onPress(); });
    expect(sends()).toHaveLength(0);

    await act(async () => {
      store.dispatch(multichainNextSendUpdate({ status: OPERATION_STATUS.RECORDED }));
    });
    expect(sendButton().props.disabled).toBe(false);
    await act(async () => { sendButton().props.onPress(); });
    expect(sends()).toHaveLength(1);
  });
});

describe('the scanner', () => {
  test('opens Send with a Hathor Next address once the side chain is connected', async () => {
    const navigation = { navigate: jest.fn(), replace: jest.fn() };
    const renderer = await mount(
      makeStore().store,
      <UnifiedQRScanner navigation={navigation} />,
    );
    const reader = renderer.root.findByType(QRCodeReader);
    await act(async () => { reader.props.onSuccess({ data: NEXT_ADDRESS }); });
    expect(navigation.navigate).toHaveBeenCalledWith('Main', {
      screen: 'Send',
      params: { screen: 'SendAddressInput', params: { address: NEXT_ADDRESS } },
    });
  });
});
