/**
 * Copyright (c) Hathor Labs and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { jest, describe, test, expect, beforeEach, afterEach } from '@jest/globals';

// Each test gives the rows a stand-in encoder of the unblinding values, none, or the real lookup.
jest.mock('../../src/utils/privacy', () => ({
  ...jest.requireActual('../../src/utils/privacy'),
  getUnblindingEncoder: jest.fn(),
}));

/* eslint-disable import/first */
import React from 'react';
import {
  ActivityIndicator, Alert, Clipboard, Linking, TouchableHighlight,
} from 'react-native';
import { act, create } from 'react-test-renderer';
import { Provider } from 'react-redux';
import { legacy_createStore as createStore } from 'redux';
import {
  HathorWalletServiceWallet,
  TokenVersion,
  constants as hathorLibConstants,
  shielded,
} from '@hathor/wallet-lib';
import { reducer } from '../../src/reducers/reducer';
import {
  networkSettingsUpdateState,
  setFeatureToggles,
  setFullNodeNetworkName,
  setWallet,
  shieldedCapabilityUpdate,
  shieldedProviderUpdate,
} from '../../src/actions';
import {
  AMOUNT_FORMAT,
  EXPLORER_SHIELDED_TESTNET_URL,
  FEATURE_TOGGLE_DEFAULTS,
  FULL_NETWORK_SHIELDED_TESTNET,
  PRE_SETTINGS_SHIELDED_TESTNET,
  PRE_SETTINGS_TESTNET,
  SENSITIVE_CLIPBOARD_CLEAR_MS,
  SENSITIVE_COPY_FEEDBACK_MS,
  SHIELDED_OUTPUTS_FEATURE_TOGGLE,
  SHIELDED_PROVIDER_STATUS,
} from '../../src/constants';
import { getUnblindingEncoder } from '../../src/utils/privacy';
import { TxHistory } from '../../src/models';
import { ListButton } from '../../src/components/HathorList';
import { PortalProvider } from '../../src/components/Portal';
import AuditUnblindingRows from '../../src/components/AuditUnblindingRows';
import TxDetailsModal from '../../src/components/TxDetailsModal';
/* eslint-enable import/first */

const { getUnblindingEncoder: realGetUnblindingEncoder } = jest.requireActual('../../src/utils/privacy');

const HTR = hathorLibConstants.NATIVE_TOKEN_UID;
const TX_ID = '00004a5dd1d7f9a3ad20a6f5a0bb2d6e6a8e81b5c2a7fd28c1f87d5a14b0e3c2';
const MINE = 'WMINE';
const THEIRS = 'WTHEIRS';
const VIEW = 'View in Explorer unblinded';
const COPY = 'Copy unblinding values';
const COPIED = 'Copied to clipboard!';
const PAYLOAD = 'eyJ2IjoxfQ';
// The opening of a private output the wallet received: its index in the tx, value, token and
// blinding factor.
const OPENING = {
  index: 1,
  value: 500n,
  token: HTR,
  vbf: '11'.repeat(32),
};
// The opening of a private output of the wallet that a tx spends, from the tx that created it.
const INPUT_OPENING = {
  index: 0,
  value: 800n,
  token: HTR,
  vbf: '22'.repeat(32),
};

const capability = (level) => ({
  level,
  reason: level === 'full' ? null : 'locked',
  cause: level === 'full' ? null : 'wrong-pin',
  canReceive: level === 'full',
  canSpend: level === 'full',
  historyComplete: true,
  undecoded: { txIds: [], locked: 0, unreadable: 0, error: 0 },
});

/**
 * A wallet whose local copy of the tx spends an input at `inputAddress`, and which owns the
 * openings of the tx that wallet-lib gives.
 */
function fakeWallet({
  inputAddress = THEIRS,
  openings = { outputs: [OPENING], inputs: [] },
} = {}) {
  const inputs = [{ tx_id: 'parent', index: 0, decoded: { address: inputAddress } }];
  return {
    getTx: jest.fn(async () => ({ tx_id: TX_ID, inputs })),
    checkAddressesMine: jest.fn(async (addresses) => Object.fromEntries(
      addresses.map((address) => [address, address === MINE]),
    )),
    getShieldedUnblindingForTx: jest.fn(async () => openings),
  };
}

const encoder = jest.fn(() => PAYLOAD);

let mounted = null;

beforeEach(() => {
  encoder.mockClear();
  getUnblindingEncoder.mockReset();
  getUnblindingEncoder.mockReturnValue(encoder);
});

afterEach(async () => {
  if (mounted) {
    await act(async () => { mounted.unmount(); });
    mounted = null;
  }
  jest.useRealTimers();
  jest.restoreAllMocks();
  Clipboard.setString.mockClear();
  Linking.openURL.mockClear();
});

/**
 * A store of a seed wallet on the network, with a ready provider and the flag on unless `flag`
 * is false, at a capability level.
 */
function makeStore({
  wallet,
  networkSettings = PRE_SETTINGS_SHIELDED_TESTNET,
  flag = true,
  level = 'full',
}) {
  const store = createStore(reducer);
  store.dispatch(networkSettingsUpdateState(networkSettings));
  store.dispatch(setFeatureToggles({
    ...FEATURE_TOGGLE_DEFAULTS,
    [SHIELDED_OUTPUTS_FEATURE_TOGGLE]: flag,
  }));
  store.dispatch(setFullNodeNetworkName(FULL_NETWORK_SHIELDED_TESTNET));
  store.dispatch(shieldedProviderUpdate({ status: SHIELDED_PROVIDER_STATUS.READY }));
  store.dispatch(shieldedCapabilityUpdate(capability(level)));
  store.dispatch(setWallet(wallet));
  return store;
}

async function render({ wallet = fakeWallet(), hasShieldedActivity, ...options } = {}) {
  const store = makeStore({ wallet, ...options });
  let renderer;
  await act(async () => {
    renderer = create(
      <Provider store={store}>
        <AuditUnblindingRows txId={TX_ID} hasShieldedActivity={hasShieldedActivity} />
      </Provider>,
    );
  });
  mounted = renderer;

  const rows = () => renderer.root.findAllByType(ListButton);
  const titles = () => rows().map((node) => node.props.title);
  const row = (title) => rows().find((node) => node.props.title === title);
  const press = (title) => act(async () => {
    row(title).props.onPress();
  });
  // A tap, through the row's touchable: a row that isn't pressable ignores it.
  const tap = (title) => act(async () => {
    row(title).findByType(TouchableHighlight).props.onPress();
  });
  const loadingRows = () => rows()
    .filter((node) => node.findAllByType(ActivityIndicator).length > 0)
    .map((node) => node.props.title);
  return {
    wallet, titles, press, tap, row, loadingRows,
  };
}

/**
 * A wallet whose read of the values waits until the test gives them, or fails it.
 */
function slowWallet() {
  const wallet = fakeWallet();
  let give;
  let fail;
  wallet.getShieldedUnblindingForTx.mockImplementation(() => new Promise((resolve, reject) => {
    give = resolve;
    fail = reject;
  }));
  return {
    wallet,
    give: (openings) => act(async () => { give(openings); }),
    fail: (error) => act(async () => { fail(error); }),
  };
}

describe('AuditUnblindingRows', () => {
  test('renders nothing in a wallet-lib build without the encoder, and reads nothing', async () => {
    getUnblindingEncoder.mockReturnValue(null);
    const { wallet, titles } = await render();

    expect(titles()).toEqual([]);
    expect(wallet.getShieldedUnblindingForTx).not.toHaveBeenCalled();
    expect(wallet.getTx).not.toHaveBeenCalled();
  });

  test('renders nothing for a wallet without getShieldedUnblindingForTx', async () => {
    const wallet = fakeWallet();
    delete wallet.getShieldedUnblindingForTx;
    const { titles } = await render({ wallet });

    expect(titles()).toEqual([]);
    expect(wallet.getTx).not.toHaveBeenCalled();
  });

  test('offers both rows on the wallet-service facade, read through its own method', async () => {
    const read = jest.spyOn(HathorWalletServiceWallet.prototype, 'getShieldedUnblindingForTx')
      .mockResolvedValue({ outputs: [OPENING], inputs: [] });
    const wallet = Object.create(HathorWalletServiceWallet.prototype);
    const { titles, press } = await render({ wallet });

    expect(titles()).toEqual([VIEW, COPY]);
    expect(read).toHaveBeenCalledWith(TX_ID);
    await press(COPY);
    expect(encoder).toHaveBeenCalledWith(TX_ID, [OPENING], []);
  });

  test('copies the values with the encoder of the wallet-lib build the app runs with', async () => {
    getUnblindingEncoder.mockImplementation(realGetUnblindingEncoder);
    const { titles, press } = await render();

    expect(titles()).toEqual([VIEW, COPY]);
    await press(COPY);

    const expected = shielded.encodeShieldedUnblindingPayload(TX_ID, [OPENING], []);
    expect(expected).not.toBe('');
    expect(Clipboard.setString.mock.calls).toEqual([[expected]]);
  });

  test('offers both rows for a tx the wallet received, on the shielded testnet, unencoded', async () => {
    const { titles } = await render();

    expect(titles()).toEqual([VIEW, COPY]);
    expect(encoder).not.toHaveBeenCalled();
  });

  test('offers only Copy where the explorer cannot read the values', async () => {
    const { titles } = await render({ networkSettings: PRE_SETTINGS_TESTNET });

    expect(titles()).toEqual([COPY]);
  });

  test.each([
    ['while the shielded UI is off', { flag: false }],
    ['while the private balance is locked', { level: 'watch' }],
  ])('renders nothing, and reads nothing, %s', async (_label, options) => {
    const { wallet, titles } = await render(options);

    expect(titles()).toEqual([]);
    expect(wallet.getShieldedUnblindingForTx).not.toHaveBeenCalled();
  });

  test('offers both rows for a tx the wallet paid, with the openings of its own outputs only', async () => {
    // wallet-lib gives the openings of the wallet's own outputs only: its change, and the
    // outputs of the wallet that the tx spends. The recipient's output has none.
    const openings = { outputs: [OPENING], inputs: [INPUT_OPENING] };
    const wallet = fakeWallet({ inputAddress: MINE, openings });
    const { titles, press } = await render({ wallet });

    expect(titles()).toEqual([VIEW, COPY]);
    await press(COPY);
    expect(encoder).toHaveBeenCalledWith(TX_ID, [OPENING], [INPUT_OPENING]);
    expect(wallet.getTx).not.toHaveBeenCalled();
    expect(wallet.checkAddressesMine).not.toHaveBeenCalled();
  });

  test('offers both rows for a tx that only spends a private output of the wallet', async () => {
    const openings = { outputs: [], inputs: [INPUT_OPENING] };
    const { titles } = await render({ wallet: fakeWallet({ inputAddress: MINE, openings }) });

    expect(titles()).toEqual([VIEW, COPY]);
  });

  test('renders nothing for a tx without private outputs of the wallet', async () => {
    const openings = { outputs: [], inputs: [] };
    const { titles } = await render({ wallet: fakeWallet({ openings }) });

    expect(titles()).toEqual([]);
  });

  test('renders nothing when the values cannot be read', async () => {
    const wallet = fakeWallet();
    wallet.getShieldedUnblindingForTx.mockRejectedValue(new Error('no values'));
    const { titles } = await render({ wallet });

    expect(titles()).toEqual([]);
  });

  test('opens the explorer at the tx with the values, without asking first', async () => {
    const alert = jest.spyOn(Alert, 'alert');
    const { press } = await render();

    await press(VIEW);

    expect(alert).not.toHaveBeenCalled();
    expect(encoder).toHaveBeenCalledWith(TX_ID, [OPENING], []);
    expect(Linking.openURL).toHaveBeenCalledWith(
      `${EXPLORER_SHIELDED_TESTNET_URL}transaction/${TX_ID}#unblind=${PAYLOAD}`,
    );
  });

  test('copies the values through the clipboard that clears itself', async () => {
    const { titles, press } = await render();
    jest.useFakeTimers();

    await press(COPY);

    expect(encoder).toHaveBeenCalledWith(TX_ID, [OPENING], []);
    expect(Clipboard.setString.mock.calls).toEqual([[PAYLOAD]]);
    expect(titles()).toEqual([VIEW, COPIED]);

    await act(async () => { jest.advanceTimersByTime(SENSITIVE_CLIPBOARD_CLEAR_MS); });
    expect(Clipboard.setString.mock.calls).toEqual([[PAYLOAD], ['']]);
    expect(titles()).toEqual([VIEW, COPY]);
  });

  test('says it copied for a second and a half', async () => {
    const { titles, press } = await render();
    jest.useFakeTimers();

    await press(COPY);
    expect(SENSITIVE_COPY_FEEDBACK_MS).toBe(1500);
    await act(async () => { jest.advanceTimersByTime(SENSITIVE_COPY_FEEDBACK_MS - 1); });
    expect(titles()).toContain(COPIED);

    await act(async () => { jest.advanceTimersByTime(1); });
    expect(titles()).toEqual([VIEW, COPY]);
    // The values are still in the clipboard.
    expect(Clipboard.setString.mock.calls).toEqual([[PAYLOAD]]);
  });
});

describe('while the values load', () => {
  test('a tx with private activity shows the rows loading, and they take no tap', async () => {
    const { wallet } = slowWallet();
    const { titles, tap, row, loadingRows, } = await render({ wallet, hasShieldedActivity: true });

    expect(titles()).toEqual([VIEW, COPY]);
    expect(loadingRows()).toEqual([VIEW, COPY]);
    expect(row(VIEW).props.disabled).toBe(true);
    expect(row(COPY).props.disabled).toBe(true);

    await tap(VIEW);
    await tap(COPY);
    expect(encoder).not.toHaveBeenCalled();
    expect(Linking.openURL).not.toHaveBeenCalled();
    expect(Clipboard.setString).not.toHaveBeenCalled();
  });

  test('the rows become pressable once the values load', async () => {
    const { wallet, give } = slowWallet();
    const { titles, tap, row, loadingRows, } = await render({ wallet, hasShieldedActivity: true });

    await give({ outputs: [OPENING], inputs: [] });

    expect(titles()).toEqual([VIEW, COPY]);
    expect(loadingRows()).toEqual([]);
    expect(row(VIEW).props.disabled).toBe(false);
    await tap(COPY);
    expect(encoder).toHaveBeenCalledWith(TX_ID, [OPENING], []);
    expect(Clipboard.setString.mock.calls).toEqual([[PAYLOAD]]);
    await tap(VIEW);
    expect(Linking.openURL).toHaveBeenCalledWith(
      `${EXPLORER_SHIELDED_TESTNET_URL}transaction/${TX_ID}#unblind=${PAYLOAD}`,
    );
  });

  test('the loading rows go away when the tx has no values of the wallet', async () => {
    const { wallet, give } = slowWallet();
    const { titles } = await render({ wallet, hasShieldedActivity: true });

    await give({ outputs: [], inputs: [] });

    expect(titles()).toEqual([]);
  });

  test('the loading rows go away when the values cannot be read', async () => {
    const { wallet, fail } = slowWallet();
    const { titles } = await render({ wallet, hasShieldedActivity: true });

    await fail(new Error('no values'));

    expect(titles()).toEqual([]);
  });

  test('only the explorer row needs the explorer that reads the values', async () => {
    const { wallet } = slowWallet();
    const { titles, loadingRows } = await render({
      wallet, hasShieldedActivity: true, networkSettings: PRE_SETTINGS_TESTNET,
    });

    expect(titles()).toEqual([COPY]);
    expect(loadingRows()).toEqual([COPY]);
  });

  test('a tx without private activity shows no row until the values come', async () => {
    const { wallet, give } = slowWallet();
    const { titles, loadingRows } = await render({ wallet });

    expect(titles()).toEqual([]);

    await give({ outputs: [OPENING], inputs: [] });
    expect(titles()).toEqual([VIEW, COPY]);
    expect(loadingRows()).toEqual([]);
  });

  test.each([
    ['while the shielded UI is off', { flag: false }],
    ['while the private balance is locked', { level: 'watch' }],
  ])('a tx with private activity shows no row %s', async (_label, options) => {
    const { wallet } = slowWallet();
    const { titles } = await render({ wallet, hasShieldedActivity: true, ...options });

    expect(titles()).toEqual([]);
    expect(wallet.getShieldedUnblindingForTx).not.toHaveBeenCalled();
  });
});

describe('TxHistory.hasShieldedActivity', () => {
  const raw = (extra) => ({
    txId: TX_ID, timestamp: 1700000000, balance: 500n, voided: false, version: 1, ...extra,
  });

  test.each([
    ['private outputs on the fullnode facade', { shielded_outputs: [{ mode: 2 }] }, true],
    ['no private outputs on the fullnode facade', { shielded_outputs: [] }, false],
    ['a private balance move on the wallet-service facade', { txKind: 'shielded' }, true],
    ['a private and public balance move on the wallet-service facade', { txKind: 'mixed' }, true],
    ['a public balance move on the wallet-service facade', { txKind: 'transparent' }, false],
    ['a tx the history says nothing private about', {}, false],
  ])('for %s', (_label, extra, expected) => {
    expect(TxHistory.from(raw(extra), HTR).hasShieldedActivity).toBe(expected);
  });
});

/**
 * Opens the tx details of a history entry, and waits for BackdropModal to show its content.
 */
async function openTxDetails(wallet, rawTx) {
  const store = makeStore({ wallet });
  const tx = TxHistory.from({
    txId: TX_ID,
    timestamp: 1700000000,
    balance: 500n,
    voided: false,
    version: 1,
    ...rawTx,
  }, HTR);
  let renderer;
  await act(async () => {
    renderer = create(
      <Provider store={store}>
        <PortalProvider>
          <TxDetailsModal
            tx={tx}
            token={{
              uid: HTR, name: 'Hathor', symbol: 'HTR', version: TokenVersion.NATIVE,
            }}
            onRequestClose={jest.fn()}
            isNFT={false}
            amountFormat={AMOUNT_FORMAT.EXPANDED}
            decimalPlaces={2}
          />
        </PortalProvider>
      </Provider>,
    );
  });
  mounted = renderer;
  // BackdropModal shows its content 100 ms after it opens.
  await act(async () => { await new Promise((resolve) => { setTimeout(resolve, 150); }); });
  const buttons = () => renderer.root.findAllByType(ListButton);
  return {
    titles: () => buttons().map((node) => node.props.title),
    disabled: () => buttons().filter((node) => node.props.disabled).map((node) => node.props.title),
  };
}

describe('the tx details', () => {
  test('of a private tx on the wallet-service facade show the rows loading at once', async () => {
    const { wallet, give } = slowWallet();
    // The wallet-service history says the tx moves the wallet's private balance.
    const { titles, disabled } = await openTxDetails(wallet, { txKind: 'shielded' });

    expect(titles()).toEqual(['Public Explorer', VIEW, COPY]);
    expect(disabled()).toEqual([VIEW, COPY]);

    await give({ outputs: [OPENING], inputs: [] });
    expect(titles()).toEqual(['Public Explorer', VIEW, COPY]);
    expect(disabled()).toEqual([]);
  });

  test('of a public tx on the wallet-service facade show only the public explorer', async () => {
    const { wallet } = slowWallet();
    const { titles } = await openTxDetails(wallet, { txKind: 'transparent' });

    expect(titles()).toEqual(['Public Explorer']);
  });

  test('show the rows under the public explorer', async () => {
    const store = makeStore({ wallet: fakeWallet() });
    const tx = TxHistory.from({
      txId: TX_ID,
      timestamp: 1700000000,
      balance: 500n,
      voided: false,
      version: 1,
      shielded_outputs: [{ mode: 1 }],
    }, HTR);
    let renderer;
    await act(async () => {
      renderer = create(
        <Provider store={store}>
          <PortalProvider>
            <TxDetailsModal
              tx={tx}
              token={{
                uid: HTR, name: 'Hathor', symbol: 'HTR', version: TokenVersion.NATIVE,
              }}
              onRequestClose={jest.fn()}
              isNFT={false}
              amountFormat={AMOUNT_FORMAT.EXPANDED}
              decimalPlaces={2}
            />
          </PortalProvider>
        </Provider>,
      );
    });
    mounted = renderer;
    // BackdropModal shows its content 100 ms after it opens.
    await act(async () => { await new Promise((resolve) => { setTimeout(resolve, 150); }); });

    const titles = renderer.root.findAllByType(ListButton).map((node) => node.props.title);
    expect(titles).toEqual(['Public Explorer', VIEW, COPY]);
  });
});
