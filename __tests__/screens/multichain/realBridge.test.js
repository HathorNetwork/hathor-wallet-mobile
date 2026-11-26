/**
 * Copyright (c) Hathor Labs and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { jest, describe, test, expect, afterEach, beforeEach } from '@jest/globals';

// The app's own bridge and chains, not the fakes: the screens that build a bridge for its quotes
// must render with the bridge the app runs.
jest.mock('@react-navigation/native', () => ({
  ...jest.requireActual('@react-navigation/native'),
  useNavigation: jest.fn(),
  useRoute: jest.fn(),
  useIsFocused: jest.fn(),
}));

jest.mock('../../../src/NavigationService', () => ({
  __esModule: true,
  default: { navigate: jest.fn(), resetToMain: jest.fn() },
}));

/* eslint-disable import/first */
import React from 'react';
import { Text } from 'react-native';
import { act, create } from 'react-test-renderer';
import { Provider } from 'react-redux';
import { legacy_createStore as createStore } from 'redux';
import { useIsFocused, useNavigation, useRoute } from '@react-navigation/native';
import { reducer } from '../../../src/reducers/reducer';
import {
  FEATURE_TOGGLE_DEFAULTS,
  MULTICHAIN_FEATURE_TOGGLE,
  MULTICHAIN_NETWORK_PRESET_FEATURE_TOGGLE,
  PRE_SETTINGS_NEXT_TESTNET,
} from '../../../src/constants';
import { STORE } from '../../../src/store';
import { selectSideChainConfig, selectSideChainKey } from '../../../src/multichain/gating';
import ChainTransferScreen from '../../../src/screens/Multichain/ChainTransferScreen';
import ChainTransferConfirmScreen from '../../../src/screens/Multichain/ChainTransferConfirmScreen';
import NextSendAmountInput from '../../../src/screens/Multichain/NextSendAmountInput';
import { PortalProvider } from '../../../src/components/Portal';
import { NEXT_STATUS } from '../../../src/multichain/state';
import { fakePeerAddress } from '../../multichain/fakes/fakeAddress';
/* eslint-enable import/first */

const NEXT_ADDRESS = fakePeerAddress('ab12');

let mounted = null;

const navigation = () => ({
  navigate: jest.fn(),
  goBack: jest.fn(),
  addListener: jest.fn(() => jest.fn()),
  setOptions: jest.fn(),
});

beforeEach(() => {
  jest.spyOn(STORE, 'isPasskeyWallet').mockReturnValue(false);
  useNavigation.mockReturnValue(navigation());
  useRoute.mockReturnValue({ params: { address: NEXT_ADDRESS } });
  useIsFocused.mockReturnValue(true);
});

afterEach(async () => {
  if (mounted) {
    await act(async () => { mounted.unmount(); });
    mounted = null;
  }
  jest.restoreAllMocks();
});

/**
 * The Hathor Next Testnet preset with its side chain connected: the config the app runs there.
 */
function makeStore() {
  const initial = reducer(undefined, { type: '@@INIT' });
  const base = {
    ...initial,
    networkSettings: PRE_SETTINGS_NEXT_TESTNET,
    featureToggles: {
      ...FEATURE_TOGGLE_DEFAULTS,
      [MULTICHAIN_FEATURE_TOGGLE]: true,
      [MULTICHAIN_NETWORK_PRESET_FEATURE_TOGGLE]: true,
    },
    serverInfo: { decimal_places: 2 },
    fullNodeNetworkName: 'testnet-juliet',
    tokensBalance: { '00': { status: 'ready', data: { available: 100000n, locked: 0n } } },
  };
  const config = selectSideChainConfig(base);
  const native = config.nativeTokenId;
  return createStore(reducer, {
    ...base,
    multichain: {
      ...initial.multichain,
      connectedNetworks: { [selectSideChainKey(base)]: true },
      next: {
        ...initial.multichain.next,
        status: NEXT_STATUS.READY,
        online: true,
        address: NEXT_ADDRESS,
        sendFee: 5000000n,
        tokens: { [native]: { id: native, name: 'US Dollar Tether', symbol: 'USDT' } },
        balances: { [native]: { status: 'ready', data: { available: 500000000000n } } },
      },
    },
  });
}

async function mount(element) {
  await act(async () => {
    mounted = create(
      <Provider store={makeStore()}><PortalProvider>{element}</PortalProvider></Provider>,
    );
  });
  return mounted;
}

const textOf = (renderer) => renderer.root.findAllByType(Text)
  .map((node) => [].concat(node.props.children).join(''));

describe('the screens that make a bridge of their own, with the app\'s bridge', () => {
  test('the transfer screen renders', async () => {
    const renderer = await mount(
      <ChainTransferScreen navigation={navigation()} route={{ params: {} }} />,
    );
    expect(textOf(renderer)).toContain('TRANSFER BETWEEN CHAINS');
  });

  test('the transfer\'s confirmation renders, with its quote', async () => {
    const renderer = await mount(
      <ChainTransferConfirmScreen
        navigation={navigation()}
        route={{ params: { amount: '1000', toAddress: NEXT_ADDRESS } }}
      />,
    );
    const texts = textOf(renderer);
    expect(texts).toContain('CONFIRM TRANSFER');
    expect(texts).toContain('Network fee');
  });

  test('Send\'s amount on Hathor Next renders, in the native token, which pays the fee', async () => {
    const renderer = await mount(<NextSendAmountInput />);
    expect(textOf(renderer)).toContain('SEND USDT');
    expect(textOf(renderer)).toContain('Network fee: 0.05 USDT');
  });
});
