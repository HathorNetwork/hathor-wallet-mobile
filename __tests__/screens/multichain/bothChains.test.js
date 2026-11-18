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
import { Provider, useSelector } from 'react-redux';
import { legacy_createStore as createStore, applyMiddleware } from 'redux';
import { useNavigation } from '@react-navigation/native';
import { reducer } from '../../../src/reducers/reducer';
import {
  multichainConnectedNetworksSet,
  tokenFetchHistoryRequested,
  tokenFetchHistorySuccess,
  types,
  updateTokenHistory,
} from '../../../src/actions';
import {
  FEATURE_TOGGLE_DEFAULTS,
  MULTICHAIN_FEATURE_TOGGLE,
  PRE_SETTINGS_TESTNET,
} from '../../../src/constants';
import { Dashboard } from '../../../src/screens/Dashboard';
import NextTokenScreen from '../../../src/screens/Multichain/NextTokenScreen';
import CopyClipboard from '../../../src/components/CopyClipboard';
import TokenSelect from '../../../src/components/TokenSelect';
import { PortalProvider } from '../../../src/components/Portal';
import { ChainFilter } from '../../../src/components/Multichain/ChainFilter';
import { MultichainTokenBody } from '../../../src/components/Multichain/MultichainTokenBody';
import { TokenHistoryList } from '../../../src/components/Multichain/TokenHistoryList';
import { TransferRow } from '../../../src/components/Multichain/TransferRow';
import { CHAIN } from '../../../src/multichain/chains';
import { HISTORY_ROW, HISTORY_VIEW } from '../../../src/multichain/history';
import { NEXT_STATUS, TRANSFER_STATUS } from '../../../src/multichain/state';
import { FAKE_NETWORK } from '../../multichain/fakes/sideChain';
/* eslint-enable import/first */

const NETWORK = FAKE_NETWORK;
const OWN_ADDRESS = `samba:${'cd34'.repeat(32)}`;
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
function makeStore({
  connected = true,
  transfers = [],
  hathorHistory = { status: 'ready', data: [] },
  nextHistory = { status: 'ready', data: [], cursor: null },
} = {}) {
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
    tokensHistory: { '00': hathorHistory },
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
          '00': nextHistory,
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

  test("never lets a long name hide a Hathor Next token's id", async () => {
    useNavigation.mockReturnValue({ navigate: jest.fn() });
    const longName = 'Hathor Network Official Stable Token Of Every Chain';
    const { store } = makeStore();
    const { next } = store.getState().multichain;
    store.dispatch({
      type: types.MULTICHAIN_NEXT_UPDATE,
      payload: {
        tokens: {
          ...next.tokens,
          b1: { id: 'b1', name: longName, symbol: 'TST', lastActivityAt: 2 },
        },
      },
    });
    const renderer = await mount(store, <Dashboard />);
    const texts = renderer.root.findAllByType(Text);
    const name = texts.find((node) => node.props.children === longName);
    const tag = texts.find((node) => node.props.children === ' · b1');
    // The name is the one cut to its line; the id has a text of its own, never cut.
    expect(name.props.numberOfLines).toBe(1);
    expect([].concat(name.props.style)).toContainEqual(expect.objectContaining({ flexShrink: 1 }));
    expect(tag.props.numberOfLines).toBeUndefined();
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
      '120.00 HTR', '25.00 HTR arriving', 'All chains', 'Moved to Hathor Next', '25.10 HTR moved',
    ]));
    expect(renderer.root.findByType(TransferRow).props.kind).toBe(HISTORY_ROW.TRANSFER);
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

// Hathor Network's history, as the wallet's getTxHistory serves it: newest first, by `skip`.
const hathorTx = (n) => ({
  txId: `h${n}`, timestamp: n * 100, balance: 100n, voided: false, tokenUid: '00',
});
const nextRow = (n) => ({
  id: `n${n}`, at: n * 100 * 1000, amount: '100000000', direction: 'in', status: 'recorded',
});
const PAGE = 2;

describe("the token screen when Hathor Network's history is fetched again", () => {
  // The server's history: h7 joins it only when it arrives.
  let server = [];

  // The user scrolled to the end: all of h6..h3 are loaded, under the first page's `updatedAt`.
  // Hathor Next's two rows sit between them, and it has no more.
  function storeAtTheEnd() {
    server = [6, 5, 4, 3].map(hathorTx);
    return makeStore({
      transfers: [],
      hathorHistory: { status: 'ready', updatedAt: 1, data: [6, 5, 4, 3].map(hathorTx) },
      nextHistory: { status: 'ready', data: [nextRow(4.5), nextRow(3.5)], cursor: null },
    }).store;
  }

  // As MainScreen's fetchMoreHathorHistory: the page after the rows loaded, appended.
  const pageAfter = (store) => {
    const loaded = store.getState().tokensHistory['00'].data;
    const page = server.slice(loaded.length, loaded.length + PAGE);
    if (page.length) {
      store.dispatch(updateTokenHistory('00', page));
    }
    return page.length;
  };

  // The body fed as MainScreen feeds it, from the store.
  function Screen({ fetchMore }) {
    const hathorHistory = useSelector((state) => state.tokensHistory['00']);
    return (
      <MultichainTokenBody
        token={HTR}
        nextTokenId='00'
        hathorHistory={hathorHistory}
        fetchMoreHathor={fetchMore}
        retryHathor={jest.fn()}
        renderHathorBalance={() => <Text>Hathor Network balance</Text>}
        renderHathorTx={() => null}
      />
    );
  }

  async function render(store, fetchMore) {
    const renderer = await mount(store, <Screen fetchMore={fetchMore} />);
    const list = () => renderer.root.findByType(TokenHistoryList);
    return {
      keys: () => list().props.rows.map((row) => row.key),
      rows: () => list().props.rows,
      reachEnd: async () => { await act(async () => { await list().props.onEndReached(); }); },
    };
  }

  // h7 arrives: wallet.js fetches HTR's history again, which brings its first page alone.
  async function h7Arrives(store) {
    server = [7, 6, 5, 4, 3].map(hathorTx);
    await act(async () => { store.dispatch(tokenFetchHistoryRequested('00', true)); });
    await act(async () => {
      store.dispatch(tokenFetchHistorySuccess('00', server.slice(0, PAGE)));
    });
  }

  const ALL_IN_ORDER = [
    'hathor:h7', 'hathor:h6', 'hathor:h5', 'next:n4.5', 'hathor:h4', 'next:n3.5', 'hathor:h3',
  ];

  test("loads the older pages again, with Hathor Next's rows in their place", async () => {
    const store = storeAtTheEnd();
    const fetchMore = jest.fn(async () => pageAfter(store));
    const screen = await render(store, fetchMore);
    await screen.reachEnd();
    expect(fetchMore).toHaveBeenCalledTimes(1);
    expect(screen.keys()).toEqual([
      'hathor:h6', 'hathor:h5', 'next:n4.5', 'hathor:h4', 'next:n3.5', 'hathor:h3',
    ]);

    await h7Arrives(store);
    // No Hathor Next row older than Hathor Network's oldest shows while it has more pages.
    expect(screen.keys().slice(0, 2)).toEqual(['hathor:h7', 'hathor:h6']);
    const oldestHathor = Math.min(...screen.rows()
      .filter((row) => row.kind === HISTORY_ROW.HATHOR).map((row) => row.time));
    expect(screen.rows().filter((row) => row.kind === HISTORY_ROW.NEXT && row.time < oldestHathor))
      .toEqual([]);

    for (let i = 0; i < 3; i += 1) {
      // eslint-disable-next-line no-await-in-loop
      await screen.reachEnd();
    }
    expect(fetchMore.mock.calls.length).toBeGreaterThan(1);
    expect(screen.keys()).toEqual(ALL_IN_ORDER);
  });

  test("a load that ended before the refetch doesn't end the new history", async () => {
    const store = storeAtTheEnd();
    // The first load asks the server before h7 arrives, past its end, and its answer (nothing)
    // comes only once h7 has arrived.
    let answerFirst;
    const fetchMore = jest.fn()
      .mockImplementationOnce(() => new Promise((resolve) => {
        const loaded = store.getState().tokensHistory['00'].data.length;
        const added = server.slice(loaded, loaded + PAGE).length;
        answerFirst = () => resolve(added);
      }))
      .mockImplementation(async () => pageAfter(store));
    const screen = await render(store, fetchMore);
    let first;
    await act(async () => { first = screen.reachEnd(); });
    await h7Arrives(store);
    await act(async () => { answerFirst(); await first; });
    expect(await fetchMore.mock.results[0].value).toBe(0);

    for (let i = 0; i < 3; i += 1) {
      // eslint-disable-next-line no-await-in-loop
      await screen.reachEnd();
    }
    expect(screen.keys()).toEqual(ALL_IN_ORDER);
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
    // Its id, in full and copyable: anyone can name a token anything on Hathor Next.
    const id = renderer.root.findAllByType(CopyClipboard);
    expect(id.map((node) => node.props.text)).toEqual(['b1']);
    expect(navigation.goBack).not.toHaveBeenCalled();
    await act(async () => { store.dispatch(multichainConnectedNetworksSet({})); });
    expect(navigation.goBack).toHaveBeenCalled();
  });
});
