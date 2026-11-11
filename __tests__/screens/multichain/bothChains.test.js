/**
 * Copyright (c) Hathor Labs and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { jest, describe, test, expect, afterEach } from '@jest/globals';

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
import { useNavigation } from '@react-navigation/native';
import { reducer } from '../../../src/reducers/reducer';
import { multichainConnectedNetworksSet, types } from '../../../src/actions';
import {
  FEATURE_TOGGLE_DEFAULTS,
  MULTICHAIN_FEATURE_TOGGLE,
  PRE_SETTINGS_TESTNET,
} from '../../../src/constants';
import { Dashboard } from '../../../src/screens/Dashboard';
import NextTokenScreen from '../../../src/screens/Multichain/NextTokenScreen';
import TokenSelect from '../../../src/components/TokenSelect';
import { PortalProvider } from '../../../src/components/Portal';
import { ChainFilter } from '../../../src/components/Multichain/ChainFilter';
import { MultichainTokenBody } from '../../../src/components/Multichain/MultichainTokenBody';
import { TransferRow } from '../../../src/components/Multichain/TransferRow';
import { CHAIN } from '../../../src/multichain/chains';
import { HISTORY_ROW, HISTORY_VIEW } from '../../../src/multichain/history';
import { NEXT_STATUS, TRANSFER_STATUS } from '../../../src/multichain/state';
import { fakePeerAddress } from '../../multichain/fakes/fakeAddress';
import { FAKE_NETWORK } from '../../multichain/fakes/sideChain';
/* eslint-enable import/first */

const NETWORK = FAKE_NETWORK;
const OWN_ADDRESS = fakePeerAddress('cd34');
const HTR = { uid: '00', name: 'Hathor', symbol: 'HTR' };
const MY_TOKEN = { uid: 'a1', name: 'My Token', symbol: 'MTK' };
const ready = (available) => ({ status: 'ready', data: { available } });

const pendingTransfer = {
  id: 't1',
  from: CHAIN.HATHOR,
  to: CHAIN.HATHOR_NEXT,
  hathorTokenId: '00',
  nextTokenId: '00',
  amount: '2510',
  receiveAmount: '2500000000',
  bridgeFee: '10',
  networkFee: '0',
  toAddress: OWN_ADDRESS,
  toOwn: true,
  sentAt: Date.now() - 1000,
  arriveAt: Date.now() + 119000,
  status: TRANSFER_STATUS.PENDING,
  sourceTxId: null,
  debitedOnSource: false,
};

let mounted = null;

afterEach(async () => {
  if (mounted) {
    await act(async () => { mounted.unmount(); });
    mounted = null;
  }
  jest.restoreAllMocks();
});

/**
 * A wallet with 95.00 HTR and My Token on Hathor Network and, on Hathor Next, 25 HTR and a Test
 * Token.
 */
function makeStore({ connected = true, transfers = [] } = {}) {
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
    tokens: { '00': HTR, a1: MY_TOKEN },
    tokensBalance: { '00': ready(9500n), a1: ready(1000n) },
    tokensHistory: { '00': { status: 'ready', data: [] } },
    selectedToken: HTR,
    multichain: {
      ...initial.multichain,
      connectedNetworks: connected ? { [NETWORK]: true } : {},
      transfers,
      next: {
        ...initial.multichain.next,
        status: NEXT_STATUS.READY,
        address: OWN_ADDRESS,
        tokens: {
          '00': { id: '00', name: 'Hathor', symbol: 'HTR', lastActivityAt: 5 },
          b1: { id: 'b1', name: 'Test Token', symbol: 'TST', lastActivityAt: 2 },
        },
        balances: { '00': ready(2500000000n), b1: ready(500000000n) },
        history: {
          '00': { status: 'ready', data: [], cursor: null },
          b1: { status: 'ready', data: [], cursor: null },
        },
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

describe('the Dashboard with the side chain connected', () => {
  test("lists both chains' tokens, HTR as one row with both balances", async () => {
    const navigation = { navigate: jest.fn() };
    useNavigation.mockReturnValue(navigation);
    const { store } = makeStore({ transfers: [pendingTransfer] });
    const renderer = await mount(store, <Dashboard />);
    const list = renderer.root.findByType(TokenSelect);
    expect(list.props.tokens.map((row) => row.uid)).toEqual(['00', 'a1', 'next:b1']);
    const texts = textOf(renderer);
    expect(texts).toEqual(expect.arrayContaining([
      '120.00', '2 chains', ' · 25.00 arriving', 'Hathor Network', 'Hathor Next',
    ]));
  });

  test("opens a Hathor Next token on its own screen, and HTR on Hathor Network's", async () => {
    const navigation = { navigate: jest.fn() };
    useNavigation.mockReturnValue(navigation);
    const { store, actions } = makeStore();
    const renderer = await mount(store, <Dashboard />);
    const list = renderer.root.findByType(TokenSelect);
    const [htr, , tst] = list.props.tokens;
    await act(async () => { list.props.onItemPress(tst); });
    expect(navigation.navigate).toHaveBeenCalledWith('NextTokenScreen', { tokenId: 'b1' });
    await act(async () => { list.props.onItemPress(htr); });
    expect(navigation.navigate).toHaveBeenLastCalledWith('MainScreen');
    expect(actions).toContainEqual(expect.objectContaining({ payload: HTR }));
  });

  test('changes nothing without the side chain', async () => {
    useNavigation.mockReturnValue({ navigate: jest.fn() });
    const { store } = makeStore({ connected: false });
    const renderer = await mount(store, <Dashboard />);
    const list = renderer.root.findByType(TokenSelect);
    expect(Object.keys(list.props.tokens)).toEqual(['00', 'a1']);
    expect(textOf(renderer)).not.toContain('2 chains');
  });
});

describe('the token screen of a token on both chains', () => {
  async function renderBody(transfers = [pendingTransfer]) {
    const { store, actions } = makeStore({ transfers });
    const renderer = await mount(
      store, (
        <MultichainTokenBody
          token={HTR}
          nextTokenId='00'
          hathorHistory={{ status: 'ready', data: [] }}
          fetchMoreHathor={async () => 0}
          retryHathor={jest.fn()}
          renderHathorBalance={() => <Text>Hathor Network balance</Text>}
          renderHathorTx={() => null}
        />
      )
    );
    const pick = async (view) => {
      await act(async () => { renderer.root.findByType(ChainFilter).props.onChange(view); });
    };
    return { store, actions, renderer, pick };
  }

  test('opens on all chains: the total, what is on its way, and a transfer as one row', async () => {
    const { renderer } = await renderBody();
    const texts = textOf(renderer);
    expect(texts).toEqual(expect.arrayContaining([
      '120.00 HTR', '25.00 HTR arriving', 'All chains', 'Moved to Hathor Next',
      '25.10 HTR moved · 0.10 fee',
    ]));
    expect(renderer.root.findByType(TransferRow).props.kind).toBe(HISTORY_ROW.TRANSFER);
  });

  // On all chains the row's amount is the cost alone, so the line under it says what moved too.
  test("says what a transfer moved and what it cost: the burn's data output", async () => {
    const burn = {
      ...pendingTransfer, amount: '1000', receiveAmount: '1000000000', bridgeFee: '0', networkFee: '1',
    };
    const { renderer } = await renderBody([burn]);
    expect(textOf(renderer)).toEqual(expect.arrayContaining([
      '10.00 HTR moved · 0.01 fee', '-0.01',
    ]));
  });

  test('says only what a transfer that cost nothing moved', async () => {
    const free = { ...pendingTransfer, amount: '2500', bridgeFee: '0', networkFee: '0' };
    const { renderer } = await renderBody([free]);
    expect(textOf(renderer)).toContain('25.00 HTR moved');
  });

  test("lists each chain's balance in the chain chip", async () => {
    const { renderer } = await renderBody();
    expect(renderer.root.findByType(ChainFilter).props.options).toEqual([
      { view: HISTORY_VIEW.ALL, balance: '120.00 HTR' },
      { view: HISTORY_VIEW.HATHOR, balance: '95.00 HTR' },
      { view: HISTORY_VIEW.HATHOR_NEXT, balance: '25.00 HTR' },
    ]);
  });

  test("shows one chain's balance, and the transfer as its side there", async () => {
    const { renderer, pick } = await renderBody();
    await pick(HISTORY_VIEW.HATHOR_NEXT);
    expect(textOf(renderer)).toEqual(expect.arrayContaining([
      '25.00 HTR', 'Transfer from Hathor Network',
    ]));
    await pick(HISTORY_VIEW.HATHOR);
    expect(textOf(renderer)).toEqual(expect.arrayContaining([
      'Hathor Network balance', 'Transferred to Hathor Next',
    ]));
  });

  test('asks for its Hathor Next history', async () => {
    const { actions } = await renderBody([]);
    expect(actions).toContainEqual({
      type: types.MULTICHAIN_NEXT_HISTORY_REQUESTED,
      payload: { tokenId: '00', more: false },
    });
  });
});

describe('the screen of a token only Hathor Next has', () => {
  test('shows its balance on Hathor Next, and closes when the side chain is turned off', async () => {
    const navigation = { navigate: jest.fn(), goBack: jest.fn() };
    const { store } = makeStore();
    const renderer = await mount(
      store,
      <NextTokenScreen navigation={navigation} route={{ params: { tokenId: 'b1' } }} />,
    );
    expect(textOf(renderer)).toEqual(expect.arrayContaining(['5.00 TST', 'Hathor Next']));
    expect(navigation.goBack).not.toHaveBeenCalled();
    await act(async () => { store.dispatch(multichainConnectedNetworksSet({})); });
    expect(navigation.goBack).toHaveBeenCalled();
  });
});
