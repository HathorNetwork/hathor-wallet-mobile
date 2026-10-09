/**
 * Copyright (c) Hathor Labs and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { jest, describe, test, expect, beforeEach, afterEach } from '@jest/globals';

// The wallet-lib build the app runs with has no encoder of the unblinding values: each test
// gives the rows one, or the real lookup.
jest.mock('../../src/utils/privacy', () => ({
  ...jest.requireActual('../../src/utils/privacy'),
  getUnblindingEncoder: jest.fn(),
}));

/* eslint-disable import/first */
import React from 'react';
import { Alert, Clipboard, Linking } from 'react-native';
import { act, create } from 'react-test-renderer';
import { Provider } from 'react-redux';
import { legacy_createStore as createStore } from 'redux';
import { TokenVersion, constants as hathorLibConstants } from '@hathor/wallet-lib';
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
const PAYLOAD = 'eyJ2IjoxfQ';
// The opening of a private output the wallet received: its index in the tx, value, token and
// blinding factor.
const OPENING = {
  index: 1,
  value: 500n,
  token: HTR,
  vbf: '11'.repeat(32),
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

async function render({ wallet = fakeWallet(), ...options } = {}) {
  const store = makeStore({ wallet, ...options });
  let renderer;
  await act(async () => {
    renderer = create(
      <Provider store={store}><AuditUnblindingRows txId={TX_ID} /></Provider>,
    );
  });
  mounted = renderer;

  const titles = () => renderer.root.findAllByType(ListButton).map((node) => node.props.title);
  const press = (title) => act(async () => {
    renderer.root.findAllByType(ListButton)
      .find((node) => node.props.title === title)
      .props.onPress();
  });
  return { wallet, titles, press };
}

describe('AuditUnblindingRows', () => {
  test('renders nothing in this wallet-lib build, which has no encoder, and reads nothing', async () => {
    getUnblindingEncoder.mockImplementation(realGetUnblindingEncoder);
    const { wallet, titles } = await render();

    expect(titles()).toEqual([]);
    expect(wallet.getShieldedUnblindingForTx).not.toHaveBeenCalled();
    expect(wallet.getTx).not.toHaveBeenCalled();
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

  test('renders nothing for a tx the wallet paid, whose values it never reads', async () => {
    const { wallet, titles } = await render({ wallet: fakeWallet({ inputAddress: MINE }) });

    expect(titles()).toEqual([]);
    expect(wallet.getShieldedUnblindingForTx).not.toHaveBeenCalled();
  });

  test.each([
    ['without private outputs of the wallet', { outputs: [], inputs: [] }],
    ['that spends an output of the wallet', { outputs: [OPENING], inputs: [OPENING] }],
  ])('renders nothing for a tx %s', async (_label, openings) => {
    const { titles } = await render({ wallet: fakeWallet({ openings }) });

    expect(titles()).toEqual([]);
  });

  test.each([
    ['the values', 'getShieldedUnblindingForTx'],
    ['the tx', 'getTx'],
  ])('renders nothing when %s cannot be read', async (_label, method) => {
    const wallet = fakeWallet();
    wallet[method].mockRejectedValue(new Error(`no ${method}`));
    const { titles } = await render({ wallet });

    expect(titles()).toEqual([]);
  });

  test('warns that the link stays in the browser history, then opens it with the values', async () => {
    const alert = jest.spyOn(Alert, 'alert');
    const { press } = await render();

    await press(VIEW);

    expect(Linking.openURL).not.toHaveBeenCalled();
    expect(alert).toHaveBeenCalledTimes(1);
    const [title, message, buttons] = alert.mock.calls[0];
    expect(title).toBe('Open the unblinded link?');
    expect(message).toBe('The link holds the values that reveal the amounts and tokens you received in this transaction. Your browser keeps it in its history, which may sync to your other devices.');
    expect(buttons.map((button) => button.text)).toEqual(['Cancel', 'Open']);

    await act(async () => { buttons[1].onPress(); });

    expect(encoder).toHaveBeenCalledWith(TX_ID, [OPENING], []);
    expect(Linking.openURL).toHaveBeenCalledWith(
      `${EXPLORER_SHIELDED_TESTNET_URL}transaction/${TX_ID}#unblind=${PAYLOAD}`,
    );
  });

  test('opens nothing, and encodes nothing, when the warning is cancelled', async () => {
    const alert = jest.spyOn(Alert, 'alert');
    const { press } = await render();

    await press(VIEW);
    const [, , [cancel]] = alert.mock.calls[0];
    expect(cancel.style).toBe('cancel');
    if (cancel.onPress) {
      await act(async () => { cancel.onPress(); });
    }

    expect(Linking.openURL).not.toHaveBeenCalled();
    expect(encoder).not.toHaveBeenCalled();
  });

  test('copies the values through the clipboard that clears itself', async () => {
    const { titles, press } = await render();
    jest.useFakeTimers();

    await press(COPY);

    expect(encoder).toHaveBeenCalledWith(TX_ID, [OPENING], []);
    expect(Clipboard.setString.mock.calls).toEqual([[PAYLOAD]]);
    expect(titles()).toContain('Copied. The clipboard clears in one minute.');

    await act(async () => { jest.advanceTimersByTime(SENSITIVE_CLIPBOARD_CLEAR_MS); });
    expect(Clipboard.setString.mock.calls).toEqual([[PAYLOAD], ['']]);
    expect(titles()).toEqual([VIEW, COPY]);
  });
});

describe('the tx details', () => {
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
