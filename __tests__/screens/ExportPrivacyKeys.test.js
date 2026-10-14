/**
 * Copyright (c) Hathor Labs and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { jest, describe, test, expect, afterEach } from '@jest/globals';

// A passkey wallet's ceremony, and the keys it derives: each test sets them.
jest.mock('../../src/passkey/passkeySigner', () => ({
  ...jest.requireActual('../../src/passkey/passkeySigner'),
  withPasskeyWords: jest.fn(),
}));
jest.mock('../../src/passkey/shieldedKeys', () => ({
  derivePasskeyShieldedKeys: jest.fn(),
}));

/* eslint-disable import/first */
import React from 'react';
import { AppState, Clipboard, TouchableOpacity } from 'react-native';
import { act, create } from 'react-test-renderer';
import { Provider } from 'react-redux';
import { legacy_createStore as createStore } from 'redux';
import { StackActions } from '@react-navigation/native';
import { reducer } from '../../src/reducers/reducer';
import {
  lockScreen,
  networkSettingsUpdateState,
  setFeatureToggles,
  setFullNodeNetworkName,
  setWallet,
  shieldedCapabilityUpdate,
  shieldedProviderUpdate,
  unlockScreen,
} from '../../src/actions';
import {
  FEATURE_TOGGLE_DEFAULTS,
  FULL_NETWORK_SHIELDED_TESTNET,
  PRE_SETTINGS_SHIELDED_TESTNET,
  SENSITIVE_CLIPBOARD_CLEAR_MS,
  SENSITIVE_COPY_FEEDBACK_MS,
  SHIELDED_OUTPUTS_FEATURE_TOGGLE,
  SHIELDED_PROVIDER_STATUS,
} from '../../src/constants';
import { PortalProvider } from '../../src/components/Portal';
import ExportPrivacyKeys from '../../src/screens/ExportPrivacyKeys';
import { STORE } from '../../src/store';
import { PasskeyCancelledError, withPasskeyWords } from '../../src/passkey/passkeySigner';
import { derivePasskeyShieldedKeys } from '../../src/passkey/shieldedKeys';
/* eslint-enable import/first */

const PIN = '135790';
// Stand-ins for the spend xpub and the scan xpriv: the screen only shows and copies them.
const SPEND_XPUB = 'xpub6EkS2eyWfDNiXk4zM7bq4dBRWgs1kqGJBDWSxRu2W7vd2Ugtc3nM7XQ8wKdo9aTZcqgjNNiEDVUSxomvLHCpxKqqA9HqmXrxBjDRPVTnmE1';
const SCAN_XPRIV = 'xprv9zyUunmbsdp4RhWSTQD3Dub6p2wBJHqbFXuW9HbPMyGgM3iUWh5PpuFWFp3b2ybA2T61D9aw6xA2EoN7BVq6oG6wkxzURSGVNvqo7nKpx6H';
// The first 12 and the last 8 characters.
const SPEND_MASKED = 'xpub6EkS2eyW…RPVTnmE1';
const SCAN_MASKED = 'xprv9zyUunmb…o7nKpx6H';

const ROUTE_KEY = 'ExportPrivacyKeys-test';
const NO_SHIELDED_KEYS = 'This wallet has no shielded keys. They are only present on wallets created after the shielded outputs feature was enabled.';
const UNLOCK_FIRST = 'Unlock your private balance to export the privacy keys.';
const UNAVAILABLE = 'Private transfers are not available for this wallet.';

const capability = (level, { cause = 'wrong-pin', reason = 'locked' } = {}) => ({
  level,
  reason: level === 'full' ? null : reason,
  cause: level === 'full' ? null : cause,
  canReceive: level === 'full',
  canSpend: level === 'full',
  historyComplete: true,
  undecoded: { txIds: [], locked: 0, unreadable: 0, error: 0 },
});

/**
 * A wallet whose live capability and keys are these.
 */
function fakeWallet({ live = capability('full') } = {}) {
  return {
    getShieldedCapability: jest.fn(async () => live),
    storage: {
      getSpendXPubKey: jest.fn(async () => SPEND_XPUB),
      getScanXPrivKey: jest.fn(async () => SCAN_XPRIV),
    },
  };
}

/**
 * A wallet-service facade wallet: it has no getShieldedCapability, and the shielded keys its
 * wallet-service registered at start() decide its capability.
 */
function fakeWalletServiceWallet({ shieldedEnabled = true } = {}) {
  return {
    isReady: () => true,
    isShieldedEnabled: () => shieldedEnabled,
    storage: {
      shieldedCryptoProvider: {},
      getSpendXPubKey: jest.fn(async () => SPEND_XPUB),
      getScanXPrivKey: jest.fn(async () => SCAN_XPRIV),
    },
  };
}

let mounted = null;

afterEach(async () => {
  if (mounted) {
    await act(async () => { mounted.unmount(); });
    mounted = null;
  }
  jest.useRealTimers();
  jest.restoreAllMocks();
  Clipboard.setString.mockClear();
});

/**
 * Renders the screen for a seed wallet on the shielded testnet, with a ready provider and the
 * flag on, whose capability in the state is `level`.
 */
async function render({ wallet = fakeWallet(), level = capability('full') } = {}) {
  const store = createStore(reducer);
  store.dispatch(networkSettingsUpdateState(PRE_SETTINGS_SHIELDED_TESTNET));
  store.dispatch(setFeatureToggles({
    ...FEATURE_TOGGLE_DEFAULTS,
    [SHIELDED_OUTPUTS_FEATURE_TOGGLE]: true,
  }));
  store.dispatch(setFullNodeNetworkName(FULL_NETWORK_SHIELDED_TESTNET));
  store.dispatch(shieldedProviderUpdate({ status: SHIELDED_PROVIDER_STATUS.READY }));
  store.dispatch(shieldedCapabilityUpdate(level));
  store.dispatch(setWallet(wallet));
  store.dispatch(unlockScreen());

  const listeners = { focus: [], blur: [] };
  // The route on top of the stack: the export's, unless a test puts the PIN screen's there.
  let topKey = ROUTE_KEY;
  const navigation = {
    navigate: jest.fn(),
    goBack: jest.fn(),
    dispatch: jest.fn(),
    getState: jest.fn(() => {
      const routes = [{ key: 'Main' }, { key: 'PrivacySettings' }, { key: ROUTE_KEY }];
      if (topKey !== ROUTE_KEY) {
        routes.push({ key: topKey });
      }
      return { index: routes.length - 1, routes };
    }),
    addListener: jest.fn((event, handler) => {
      listeners[event] = [...(listeners[event] ?? []), handler];
      return jest.fn();
    }),
  };
  const setTop = (key) => { topKey = key; };
  const emit = (event) => act(async () => {
    listeners[event].forEach((handler) => handler());
  });
  const appStateCalls = AppState.addEventListener.mock.calls.length;
  let renderer;
  await act(async () => {
    renderer = create(
      <Provider store={store}>
        <PortalProvider>
          <ExportPrivacyKeys
            navigation={navigation}
            route={{ key: ROUTE_KEY, name: 'ExportPrivacyKeys' }}
          />
        </PortalProvider>
      </Provider>,
    );
  });
  mounted = renderer;
  // The screen's own listener: the first one it added.
  const [, onAppState] = AppState.addEventListener.mock.calls[appStateCalls];

  const texts = () => renderer.root
    .findAll((node) => node.type === 'Text')
    .map((node) => [].concat(node.props.children).join(''));
  const titles = () => renderer.root
    .findAll((node) => typeof node.props.title === 'string' && typeof node.props.onPress === 'function')
    .map((node) => node.props.title);
  // Presses the index-th pressable text with the label, as "Copy" on the scan key, the second.
  const pressText = (label, index = 0) => act(async () => {
    renderer.root.findAllByType(TouchableOpacity).filter(
      (node) => node.findAll((child) => child.type === 'Text' && child.props.children === label)
        .length > 0,
    )[index].props.onPress();
  });
  const pinScreenCalls = () => navigation.navigate.mock.calls
    .filter(([name]) => name === 'PinScreen');
  /** Enters the PIN, as the PIN screen calls back with it after it goes back. */
  const enterPin = async (pin = PIN) => {
    const [, params] = pinScreenCalls()[pinScreenCalls().length - 1];
    await act(async () => { await params.cb(pin); });
  };
  return {
    store,
    renderer,
    navigation,
    emit,
    setTop,
    onAppState,
    texts,
    titles,
    pressText,
    pinScreenCalls,
    enterPin,
  };
}

/**
 * What a closeScreen of the export dispatched, on a stack with the privacy settings under it.
 */
const closedFromStack = (navigation) => {
  const [[action]] = navigation.dispatch.mock.calls;
  return action({
    index: 2,
    routes: [{ key: 'Main' }, { key: 'PrivacySettings' }, { key: ROUTE_KEY }],
  });
};

// How the screen closes, with its PIN screen, when the shielded UI stops being available, and how
// it goes back when its PIN screen closes, is also tested in a real stack, in
// PrivacyScreensStack.test.js.
describe('ExportPrivacyKeys', () => {
  test('asks for the PIN as it opens, with params that carry no PIN and no key', async () => {
    const wallet = fakeWallet();
    const { pinScreenCalls } = await render({ wallet });

    expect(pinScreenCalls()).toHaveLength(1);
    const [, params] = pinScreenCalls()[0];
    expect(params).toEqual({
      cb: expect.any(Function),
      canCancel: true,
      screenText: 'Enter your 6-digit PIN to export the audit keys',
    });
    expect(wallet.getShieldedCapability).not.toHaveBeenCalled();
    expect(wallet.storage.getSpendXPubKey).not.toHaveBeenCalled();
    expect(wallet.storage.getScanXPrivKey).not.toHaveBeenCalled();
  });

  test('shows the warning, before and after the PIN', async () => {
    const warning = [
      'EXPORT PRIVACY KEYS',
      'Read this before sharing',
      'These two keys give an auditor read-only access to every shielded output your wallet receives — they can identify every incoming shielded transaction and decrypt the amount and token of each one.',
      'They do NOT allow spending. Whoever holds them cannot move your funds, sign transactions on your behalf, or access transparent (non-shielded) balances.',
      'Treat them like any other private wallet data. Share them only with auditors you trust, and over a secure channel.',
    ];
    const { texts, enterPin } = await render();
    expect(texts()).toEqual(warning);

    await enterPin();

    expect(texts().slice(0, warning.length)).toEqual(warning);
  });

  test('checks the capability, then reads the keys with the PIN the PIN screen gives', async () => {
    const wallet = fakeWallet();
    const { enterPin } = await render({ wallet });

    await enterPin();

    expect(wallet.storage.getScanXPrivKey).toHaveBeenCalledWith(PIN);
    expect(wallet.storage.getSpendXPubKey).toHaveBeenCalledTimes(1);
    const checked = wallet.getShieldedCapability.mock.invocationCallOrder[0];
    expect(checked).toBeLessThan(wallet.storage.getScanXPrivKey.mock.invocationCallOrder[0]);
    expect(checked).toBeLessThan(wallet.storage.getSpendXPubKey.mock.invocationCallOrder[0]);
  });

  test('says it derives the keys while it reads them', async () => {
    const wallet = fakeWallet();
    let respond;
    wallet.storage.getScanXPrivKey.mockImplementation(
      () => new Promise((resolve) => { respond = resolve; }),
    );
    const { texts, pinScreenCalls } = await render({ wallet });
    const [, params] = pinScreenCalls()[0];
    let read;
    await act(async () => { read = params.cb(PIN); });

    expect(texts()).toContain('Deriving keys…');

    await act(async () => {
      respond(SCAN_XPRIV);
      await read;
    });
    expect(texts()).not.toContain('Deriving keys…');
    expect(texts()).toContain(SCAN_MASKED);
  });

  test('shows each key masked, with what it gives, and the full key on request', async () => {
    const { renderer, texts, pressText, enterPin } = await render();

    await enterPin();

    expect(texts()).toEqual(expect.arrayContaining([
      'Spend public key (xpub)',
      "Path m/44'/280'/2'/0. Lets the auditor derive every receiving spend-side address and find your incoming shielded outputs on-chain.",
      SPEND_MASKED,
      'Scan private key (xpriv)',
      "Path m/44'/280'/1'/0. Lets the auditor decrypt the value and token of every shielded output your wallet receives. Used only for ECDH; never for signing.",
      SCAN_MASKED,
    ]));
    expect(JSON.stringify(renderer.toJSON())).not.toContain(SCAN_XPRIV);

    // The scan key's card is the second one.
    await pressText('Show full key', 1);
    expect(texts()).toContain(SCAN_XPRIV);
    expect(texts()).toContain(SPEND_MASKED);

    await pressText('Hide');
    expect(texts()).toContain(SCAN_MASKED);
    expect(texts()).not.toContain(SCAN_XPRIV);
  });

  test('makes the text of each key selectable, masked or in full', async () => {
    const { renderer, pressText, enterPin } = await render();
    await enterPin();
    const selectableTexts = () => renderer.root
      .findAll((node) => node.type === 'Text' && node.props.selectable)
      .map((node) => [].concat(node.props.children).join(''));

    expect(selectableTexts()).toEqual([SPEND_MASKED, SCAN_MASKED]);

    await pressText('Show full key', 1);

    expect(selectableTexts()).toEqual([SPEND_MASKED, SCAN_XPRIV]);
  });

  test('copies a key in full, masked or not, and the clipboard clears a minute later', async () => {
    const { texts, pressText, enterPin } = await render();
    await enterPin();
    jest.useFakeTimers();

    await pressText('Copy', 1);

    expect(Clipboard.setString.mock.calls).toEqual([[SCAN_XPRIV]]);
    expect(texts()).toContain('Copied');

    await act(async () => { jest.advanceTimersByTime(SENSITIVE_CLIPBOARD_CLEAR_MS); });
    expect(Clipboard.setString.mock.calls).toEqual([[SCAN_XPRIV], ['']]);
  });

  test('says Copied for a second and a half, on the key copied', async () => {
    const { texts, pressText, enterPin } = await render();
    await enterPin();
    jest.useFakeTimers();

    await pressText('Copy', 1);
    expect(texts().filter((text) => text === 'Copied')).toHaveLength(1);
    expect(texts().indexOf('Copied')).toBeGreaterThan(texts().indexOf(SCAN_MASKED));

    await act(async () => { jest.advanceTimersByTime(SENSITIVE_COPY_FEEDBACK_MS - 1); });
    expect(texts()).toContain('Copied');

    await act(async () => { jest.advanceTimersByTime(1); });
    expect(texts()).not.toContain('Copied');
    // The key is still in the clipboard.
    expect(Clipboard.setString.mock.calls).toEqual([[SCAN_XPRIV]]);
  });

  test('hides the keys while the app is not active', async () => {
    const { texts, onAppState, enterPin } = await render();
    await enterPin();

    await act(async () => { onAppState('inactive'); });
    expect(texts()).not.toContain(SCAN_MASKED);
    expect(texts()).not.toContain(SPEND_MASKED);

    await act(async () => { onAppState('background'); });
    expect(texts()).not.toContain(SCAN_MASKED);

    await act(async () => { onAppState('active'); });
    expect(texts()).toEqual(expect.arrayContaining([SPEND_MASKED, SCAN_MASKED]));
  });

  test('goes back to the privacy settings when the PIN screen closes without the PIN', async () => {
    const wallet = fakeWallet();
    const { navigation, emit, setTop } = await render({ wallet });

    // The PIN screen comes up over the export, then closes.
    setTop('PinScreen-test');
    await emit('blur');
    expect(navigation.dispatch).not.toHaveBeenCalled();
    setTop(ROUTE_KEY);
    await emit('focus');

    expect(navigation.dispatch).toHaveBeenCalledTimes(1);
    expect(closedFromStack(navigation)).toEqual(StackActions.pop(1));
    expect(wallet.storage.getScanXPrivKey).not.toHaveBeenCalled();
  });

  test('stays open when the PIN screen gives the PIN, and asks for no other', async () => {
    const { navigation, emit, setTop, enterPin, texts, pinScreenCalls } = await render();

    setTop('PinScreen-test');
    await emit('blur');
    // The PIN screen goes back, then calls back with the PIN.
    setTop(ROUTE_KEY);
    await enterPin();
    await emit('focus');

    expect(navigation.dispatch).not.toHaveBeenCalled();
    expect(texts()).toContain(SCAN_MASKED);
    expect(pinScreenCalls()).toHaveLength(1);
  });

  test('stays open on the focus of its opening, with the PIN screen already over it', async () => {
    const { navigation, emit, setTop } = await render();

    setTop('PinScreen-test');
    await emit('focus');

    expect(navigation.dispatch).not.toHaveBeenCalled();
  });

  test('keeps the keys when the screen loses focus, and when the lock screen comes and goes', async () => {
    const { store, texts, emit, enterPin } = await render();
    await enterPin();

    await emit('blur');
    await emit('focus');
    expect(texts()).toEqual(expect.arrayContaining([SPEND_MASKED, SCAN_MASKED]));

    await act(async () => { store.dispatch(lockScreen()); });
    await act(async () => { store.dispatch(unlockScreen()); });
    expect(texts()).toEqual(expect.arrayContaining([SPEND_MASKED, SCAN_MASKED]));
  });

  test('keeps no PIN and no key in the redux state', async () => {
    const { store, enterPin } = await render();

    await enterPin();

    // The state holds the wallet itself, the fake whose methods return the keys.
    const json = JSON.stringify(store.getState(), (key, value) => {
      if (key === 'wallet') return undefined;
      return typeof value === 'bigint' ? value.toString() : value;
    });
    expect(json).not.toContain(PIN);
    expect(json).not.toContain(SCAN_XPRIV);
    expect(json).not.toContain(SPEND_XPUB);
  });

  test.each([
    ['locked by a PIN', capability('watch'), UNLOCK_FIRST],
    ['locked by a scan key no PIN can unlock', capability('watch', { cause: 'corrupt-key' }), UNAVAILABLE],
    ['without shielded keys', capability('none', { reason: 'no-shielded-keys', cause: null }), NO_SHIELDED_KEYS],
  ])('stops before it decrypts, and says why, when the wallet is now %s', async (_label, live, text) => {
    const wallet = fakeWallet({ live });
    const { texts, enterPin } = await render({ wallet });

    await enterPin();

    expect(wallet.storage.getScanXPrivKey).not.toHaveBeenCalled();
    expect(texts()).toContain(text);
    expect(texts()).not.toContain(SPEND_MASKED);
  });

  test('says the wallet has no shielded keys when it has no spend xpub', async () => {
    const wallet = fakeWallet();
    wallet.storage.getSpendXPubKey.mockResolvedValue(undefined);
    const { texts, enterPin } = await render({ wallet });

    await enterPin();

    expect(texts()).toContain(NO_SHIELDED_KEYS);
    expect(texts()).not.toContain(SCAN_MASKED);
  });

  test('says the wallet is not ready when it has no storage', async () => {
    const wallet = fakeWallet();
    delete wallet.storage;
    const { texts, enterPin } = await render({ wallet });

    await enterPin();

    expect(texts()).toContain('Wallet not ready');
    expect(wallet.getShieldedCapability).not.toHaveBeenCalled();
  });

  test('decrypts nothing when the PIN screen calls back after the screen went away', async () => {
    const wallet = fakeWallet();
    const { pinScreenCalls } = await render({ wallet });
    const [, params] = pinScreenCalls()[0];

    await act(async () => { mounted.unmount(); });
    mounted = null;
    await act(async () => { await params.cb(PIN); });

    expect(wallet.getShieldedCapability).not.toHaveBeenCalled();
    expect(wallet.storage.getScanXPrivKey).not.toHaveBeenCalled();
  });

  test('shows the error\'s message when a key cannot be read, and logs nothing', async () => {
    const wallet = fakeWallet();
    // What wallet-lib throws for a wallet without a scan key.
    const message = 'Scan private key is not present on this wallet.';
    wallet.storage.getScanXPrivKey.mockRejectedValue(new Error(message));
    const consoleSpies = ['log', 'debug', 'info', 'warn', 'error']
      .map((method) => jest.spyOn(console, method));
    const { texts, enterPin } = await render({ wallet });

    await enterPin();

    expect(texts()).toContain(message);
    expect(texts()).not.toContain(SPEND_MASKED);
    const logged = JSON.stringify(consoleSpies.flatMap((spy) => spy.mock.calls), (_key, value) => (
      value instanceof Error ? value.message : value
    ));
    expect(logged).not.toContain(message);
    expect(logged).not.toContain(PIN);
    expect(logged).not.toContain(SPEND_XPUB);
  });

  test('shows what a read failed with when it is not an Error', async () => {
    const wallet = fakeWallet();
    wallet.storage.getSpendXPubKey.mockRejectedValue('The storage is closed.');
    const { texts, enterPin } = await render({ wallet });

    await enterPin();

    expect(texts()).toContain('The storage is closed.');
  });

  test('shows the spend key alone when the wallet gives no scan key', async () => {
    const wallet = fakeWallet();
    wallet.storage.getScanXPrivKey.mockResolvedValue(undefined);
    const { texts, enterPin } = await render({ wallet });

    await enterPin();

    expect(texts()).toEqual(expect.arrayContaining(['Spend public key (xpub)', SPEND_MASKED]));
    expect(texts()).not.toContain('Scan private key (xpriv)');
  });

  test('asks to unlock a locked private balance, then asks for the PIN once it is unlocked', async () => {
    const { store, texts, titles, pinScreenCalls } = await render({ level: capability('watch') });

    expect(texts()).toContain(UNLOCK_FIRST);
    expect(titles()).toContain('Unlock private balance');
    expect(pinScreenCalls()).toEqual([]);

    await act(async () => { store.dispatch(shieldedCapabilityUpdate(capability('full'))); });

    expect(pinScreenCalls()).toHaveLength(1);
    expect(texts()).not.toContain(UNLOCK_FIRST);
  });

  test('says the wallet has no shielded keys, without asking for the PIN', async () => {
    const level = capability('none', { reason: 'no-shielded-keys', cause: null });
    const { texts, titles, pinScreenCalls } = await render({ level });

    expect(texts()).toContain(NO_SHIELDED_KEYS);
    expect(titles()).not.toContain('Unlock private balance');
    expect(pinScreenCalls()).toEqual([]);
  });

  test('reads the keys of a wallet-service facade wallet whose wallet-service registered them', async () => {
    const wallet = fakeWalletServiceWallet();
    const { texts, enterPin } = await render({ wallet });

    await enterPin();

    expect(wallet.storage.getScanXPrivKey).toHaveBeenCalledWith(PIN);
    expect(texts()).toEqual(expect.arrayContaining([SPEND_MASKED, SCAN_MASKED]));
  });

  test('stops before it decrypts on a wallet-service facade wallet without registered shielded keys', async () => {
    const wallet = fakeWalletServiceWallet({ shieldedEnabled: false });
    const { texts, enterPin } = await render({ wallet });

    await enterPin();

    expect(wallet.storage.getScanXPrivKey).not.toHaveBeenCalled();
    expect(texts()).toContain(NO_SHIELDED_KEYS);
    expect(texts()).not.toContain(SPEND_MASKED);
  });

  test.each([
    ['a scan key no PIN can unlock', capability('watch', { cause: 'corrupt-key' })],
    ['shielded keys that do not match', capability('none', { reason: 'integrity', cause: 'key-mismatch' })],
    ['a scan key given at start that does not match', capability('watch', { cause: 'key-mismatch' })],
  ])('offers no export for %s', async (_label, level) => {
    const { texts, titles, pinScreenCalls } = await render({ level });

    expect(texts()).toContain(UNAVAILABLE);
    expect(titles()).not.toContain('Unlock private balance');
    expect(pinScreenCalls()).toEqual([]);
  });
});

describe('ExportPrivacyKeys of a passkey wallet', () => {
  const WORDS = 'passkey words';

  const passkeyWallet = () => {
    jest.spyOn(STORE, 'isPasskeyWallet').mockReturnValue(true);
    withPasskeyWords.mockImplementation(async (fn) => fn(WORDS));
    derivePasskeyShieldedKeys.mockReturnValue({
      shieldedXpubs: { scanXpubkey: 'xpub-scan', spendXpubkey: SPEND_XPUB },
      scanXPrivKey: SCAN_XPRIV,
    });
  };

  afterEach(() => {
    withPasskeyWords.mockReset();
    derivePasskeyShieldedKeys.mockReset();
  });

  // The ceremony takes the PIN's place: it derives the keys from the wallet's root.
  test('shows the keys a passkey ceremony derives, without a PIN screen', async () => {
    passkeyWallet();
    const wallet = fakeWallet();
    const { texts, pinScreenCalls, onAppState } = await render({ wallet });
    await act(async () => { onAppState('active'); });

    expect(pinScreenCalls()).toEqual([]);
    expect(withPasskeyWords).toHaveBeenCalledTimes(1);
    expect(derivePasskeyShieldedKeys).toHaveBeenCalledWith(WORDS);
    expect(texts()).toEqual(expect.arrayContaining([SPEND_MASKED, SCAN_MASKED]));
    expect(wallet.storage.getScanXPrivKey).not.toHaveBeenCalled();
  });

  test('goes back to the privacy settings when the user dismisses the ceremony', async () => {
    passkeyWallet();
    withPasskeyWords.mockRejectedValue(new PasskeyCancelledError());
    const { navigation, pinScreenCalls, texts } = await render();

    expect(pinScreenCalls()).toEqual([]);
    expect(navigation.dispatch).toHaveBeenCalledTimes(1);
    expect(closedFromStack(navigation)).toEqual(StackActions.pop(1));
    expect(texts()).not.toContain(SPEND_MASKED);
  });

  test('shows the message of a ceremony that fails', async () => {
    passkeyWallet();
    withPasskeyWords.mockRejectedValue(new Error('This passkey opens a different wallet.'));
    const { navigation, texts } = await render();

    expect(texts()).toContain('This passkey opens a different wallet.');
    expect(navigation.dispatch).not.toHaveBeenCalled();
  });

  // A dismissed ceremony closes the export: one that ends after the export went away must not
  // close the screen under it.
  test('closes nothing when the ceremony ends after the screen went away', async () => {
    passkeyWallet();
    let dismiss;
    withPasskeyWords.mockImplementation(() => new Promise((_resolve, reject) => {
      dismiss = () => reject(new PasskeyCancelledError());
    }));
    const { navigation } = await render();
    expect(withPasskeyWords).toHaveBeenCalledTimes(1);

    await act(async () => { mounted.unmount(); });
    mounted = null;
    await act(async () => { dismiss(); });

    expect(navigation.dispatch).not.toHaveBeenCalled();
    expect(navigation.goBack).not.toHaveBeenCalled();
  });

  test('runs the ceremony only once the locked private balance is unlocked', async () => {
    passkeyWallet();
    const { store, texts } = await render({ level: capability('watch', { cause: 'not-supplied' }) });

    expect(texts()).toContain(UNLOCK_FIRST);
    expect(withPasskeyWords).not.toHaveBeenCalled();

    await act(async () => { store.dispatch(shieldedCapabilityUpdate(capability('full'))); });

    expect(withPasskeyWords).toHaveBeenCalledTimes(1);
  });
});
