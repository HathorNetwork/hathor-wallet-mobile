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

// A network the tests give a side chain.
// eslint-disable-next-line global-require
jest.mock('../../../src/multichain/chains', () => require('../../multichain/fakes/chainsModule'));

/* eslint-disable import/first */
import React from 'react';
import { Text } from 'react-native';
import { act, create } from 'react-test-renderer';
import { Provider } from 'react-redux';
import { legacy_createStore as createStore, applyMiddleware } from 'redux';
import { useNavigation, useRoute } from '@react-navigation/native';
import { reducer } from '../../../src/reducers/reducer';
import { multichainNextCreateTokenUpdate, types } from '../../../src/actions';
import {
  FEATURE_TOGGLE_DEFAULTS,
  MULTICHAIN_FEATURE_TOGGLE,
  MULTICHAIN_TOKEN_CREATE_FEATURE_TOGGLE,
  PRE_SETTINGS_TESTNET,
} from '../../../src/constants';
import { STORE } from '../../../src/store';
import NextCreateTokenScreen, {
  tokenFormError,
} from '../../../src/screens/Multichain/NextCreateTokenScreen';
import NextCreateTokenConfirmScreen from '../../../src/screens/Multichain/NextCreateTokenConfirmScreen';
import SimpleInput from '../../../src/components/SimpleInput';
import AmountTextInput from '../../../src/components/AmountTextInput';
import FeedbackModal from '../../../src/components/FeedbackModal';
import NewHathorButton from '../../../src/components/NewHathorButton';
import { PortalProvider } from '../../../src/components/Portal';
import { NEXT_STATUS, OPERATION_STATUS } from '../../../src/multichain/state';
import { fakePeerAddress } from '../../multichain/fakes/fakeAddress';
import { FAKE_NETWORK } from '../../multichain/fakes/sideChain';
/* eslint-enable import/first */

const NETWORK = FAKE_NETWORK;
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

function makeStore({ nativeBalance = 300000000n, next = {}, tokenFlag = true } = {}) {
  const initial = reducer(undefined, { type: '@@INIT' });
  const actions = [];
  const record = () => (nextFn) => (action) => {
    actions.push(action);
    return nextFn(action);
  };
  const store = createStore(reducer, {
    ...initial,
    networkSettings: PRE_SETTINGS_TESTNET,
    featureToggles: {
      ...FEATURE_TOGGLE_DEFAULTS,
      [MULTICHAIN_FEATURE_TOGGLE]: true,
      [MULTICHAIN_TOKEN_CREATE_FEATURE_TOGGLE]: tokenFlag,
    },
    serverInfo: { decimal_places: 2 },
    fullNodeNetworkName: NETWORK,
    tokens: { '00': HTR },
    selectedToken: HTR,
    multichain: {
      ...initial.multichain,
      connectedNetworks: { [NETWORK]: true },
      next: {
        ...initial.multichain.next,
        status: NEXT_STATUS.READY,
        online: true,
        address: fakePeerAddress('cd34'),
        sendFee: 5000000n,
        canCreateTokens: true,
        tokens: { '00': { id: '00', name: 'Hathor', symbol: 'HTR' } },
        balances: { '00': { status: 'ready', data: { available: nativeBalance } } },
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
  .filter(Boolean)
  .join(' ');

const button = (renderer, title) => renderer.root.findAllByType(NewHathorButton)
  .find((node) => node.props.title === title);

describe('the token form', () => {
  async function fill({ name = 'App Test Token', symbol = 'att', amount = '1000' } = {}, options) {
    const navigation = { navigate: jest.fn(), goBack: jest.fn() };
    useNavigation.mockReturnValue(navigation);
    useRoute.mockReturnValue({ params: {} });
    const renderer = await mount(makeStore(options).store, <NextCreateTokenScreen />);
    const [nameInput, symbolInput] = renderer.root.findAllByType(SimpleInput);
    await act(async () => { nameInput.props.onChangeText(name); });
    await act(async () => { symbolInput.props.onChangeText(symbol); });
    await act(async () => {
      const value = amount ? BigInt(amount) * 100000000n : null;
      renderer.root.findByType(AmountTextInput).props.onAmountUpdate(amount, value);
    });
    return { renderer, navigation };
  }

  test('says a creation is public and its keys come from the words, before anything is asked', async () => {
    const { renderer } = await fill();
    const text = textOf(renderer);
    expect(text).toContain('Creating a token is public');
    expect(text).toContain('come from your recovery words');
    expect(text).toContain('Network fee: 0.05 HTR');
  });

  test('uppercases the symbol and goes on to the confirmation with the supply in base units', async () => {
    const { renderer, navigation } = await fill();
    await act(async () => { button(renderer, 'Next').props.onPress(); });
    expect(navigation.navigate).toHaveBeenCalledWith('NextCreateTokenConfirm', {
      name: 'App Test Token',
      symbol: 'ATT',
      amount: '100000000000',
    });
  });

  test('refuses a symbol of other characters in words, and goes nowhere', async () => {
    const { renderer, navigation } = await fill({ symbol: 'at-t' });
    expect(textOf(renderer)).toContain('Symbols use letters and numbers only.');
    expect(button(renderer, 'Next').props.disabled).toBe(true);
    await act(async () => { button(renderer, 'Next').props.onPress(); });
    expect(navigation.navigate).not.toHaveBeenCalled();
  });

  test('says the fee is in HTR when Hathor Next holds too little of it', async () => {
    const { renderer, navigation } = await fill({}, { nativeBalance: 1000n });
    await act(async () => { button(renderer, 'Next').props.onPress(); });
    expect(textOf(renderer)).toContain('The network fee is paid in HTR');
    expect(navigation.navigate).not.toHaveBeenCalled();
  });

  test.each([
    ['a one-letter symbol', { name: 'Token', symbol: 'A', amount: 1n }, 'A symbol has 2 to 12'],
    ['a name with a space around it', { name: ' Token', symbol: 'ATT', amount: 1n }, 'with a space'],
    ['a name over 64 bytes', { name: 'é'.repeat(40), symbol: 'ATT', amount: 1n }, 'this long'],
    ['no supply', { name: 'Token', symbol: 'ATT', amount: 0n }, 'Invalid amount'],
  ])('refuses %s', (_, form, words) => {
    expect(tokenFormError(form)).toContain(words);
  });

  test('takes a well-formed token', () => {
    expect(tokenFormError({ name: 'App Test Token', symbol: 'ATT', amount: 1n })).toBeNull();
  });
});

describe('the token confirmation', () => {
  const params = { name: 'App Test Token', symbol: 'ATT', amount: '100000000000' };

  async function confirm(options) {
    const navigation = {
      navigate: jest.fn(), goBack: jest.fn(), addListener: jest.fn(() => jest.fn()),
    };
    useNavigation.mockReturnValue(navigation);
    useRoute.mockReturnValue({ params });
    const { store, actions } = makeStore(options);
    const renderer = await mount(store, <NextCreateTokenConfirmScreen />);
    return { renderer, navigation, store, actions };
  }

  test('shows the token and its fee, and asks the PIN before anything is created', async () => {
    const { renderer, navigation, actions } = await confirm();
    const text = textOf(renderer);
    expect(text).toContain('App Test Token');
    expect(text).toContain('1,000.00 ATT');
    expect(text).toContain('0.05 HTR');
    await act(async () => { button(renderer, 'Create token').props.onPress(); });
    const [, pinParams] = navigation.navigate.mock.calls.find(([route]) => route === 'PinScreen');
    const requestedNow = () => actions
      .some((a) => a.type === types.MULTICHAIN_NEXT_CREATE_TOKEN_REQUESTED);
    expect(requestedNow()).toBe(false);
    await act(async () => { pinParams.cb('123456'); });
    const requested = actions.find((a) => a.type === types.MULTICHAIN_NEXT_CREATE_TOKEN_REQUESTED);
    expect(requested.payload).toMatchObject({
      symbol: 'ATT', name: 'App Test Token', amount: 100000000000n, pinCode: '123456',
    });
    // Create never turns back on: the draft is spent.
    expect(button(renderer, 'Create token').props.disabled).toBe(true);
  });

  test('a passkey wallet goes straight to the saga, which runs the ceremony', async () => {
    STORE.isPasskeyWallet.mockReturnValue(true);
    const { renderer, navigation, actions } = await confirm();
    await act(async () => { button(renderer, 'Create token').props.onPress(); });
    expect(navigation.navigate).not.toHaveBeenCalledWith('PinScreen', expect.anything());
    const requested = actions.find((a) => a.type === types.MULTICHAIN_NEXT_CREATE_TOKEN_REQUESTED);
    expect(requested.payload.pinCode).toBeUndefined();
  });

  test('shows the outcome: creating, then the token created with its id', async () => {
    const { renderer, navigation, store, actions, } = await confirm();
    await act(async () => { button(renderer, 'Create token').props.onPress(); });
    const [, pinParams] = navigation.navigate.mock.calls.find(([route]) => route === 'PinScreen');
    await act(async () => { pinParams.cb('123456'); });
    const { draftId } = actions
      .find((a) => a.type === types.MULTICHAIN_NEXT_CREATE_TOKEN_REQUESTED).payload;
    await act(async () => {
      store.dispatch(multichainNextCreateTokenUpdate({
        status: OPERATION_STATUS.SENDING, draftId,
      }));
    });
    expect(renderer.root.findByType(FeedbackModal).props.text)
      .toContain('Creating ATT on Hathor Next');
    await act(async () => {
      store.dispatch(multichainNextCreateTokenUpdate({
        status: OPERATION_STATUS.RECORDED, tokenId: 'ab'.repeat(32),
      }));
    });
    const modal = renderer.root.findByType(FeedbackModal);
    expect(modal.props.text).toContain('ATT was created on Hathor Next');
    expect(modal.props.text).toContain('ab'.repeat(32));
  });

  test('waits while an earlier creation is on its way', async () => {
    const { renderer, store } = await confirm();
    await act(async () => {
      store.dispatch(multichainNextCreateTokenUpdate({ status: 'pending', draftId: 'another' }));
    });
    expect(button(renderer, 'Create token').props.disabled).toBe(true);
    expect(textOf(renderer)).toContain('An earlier token creation is still on its way');
  });
});
