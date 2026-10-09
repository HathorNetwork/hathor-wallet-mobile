/**
 * Copyright (c) Hathor Labs and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { jest, describe, test, expect, afterEach } from '@jest/globals';
import React from 'react';
import { AppState, Clipboard } from 'react-native';
import { act, create } from 'react-test-renderer';
import { Provider } from 'react-redux';
import { legacy_createStore as createStore } from 'redux';
import { errors } from '@hathor/wallet-lib';
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

const PIN = '135790';
// Stand-ins for the spend xpub and the scan xpriv: the screen only shows and copies them.
const SPEND_XPUB = 'xpub6EkS2eyWfDNiXk4zM7bq4dBRWgs1kqGJBDWSxRu2W7vd2Ugtc3nM7XQ8wKdo9aTZcqgjNNiEDVUSxomvLHCpxKqqA9HqmXrxBjDRPVTnmE1';
const SCAN_XPRIV = 'xprv9zyUunmbsdp4RhWSTQD3Dub6p2wBJHqbFXuW9HbPMyGgM3iUWh5PpuFWFp3b2ybA2T61D9aw6xA2EoN7BVq6oG6wkxzURSGVNvqo7nKpx6H';
// The first and the last 8 characters.
const SPEND_MASKED = 'xpub6EkS…RPVTnmE1';
const SCAN_MASKED = 'xprv9zyU…o7nKpx6H';

const READ_FAILED = 'The privacy keys could not be read.';
const EXPORT = 'I understand, export the keys';
const COPIED = 'Copied. The clipboard clears in one minute.';

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

  const listeners = {};
  const navigation = {
    navigate: jest.fn(),
    goBack: jest.fn(),
    dispatch: jest.fn(),
    addListener: jest.fn((event, handler) => {
      listeners[event] = handler;
      return jest.fn();
    }),
  };
  const appStateCalls = AppState.addEventListener.mock.calls.length;
  let renderer;
  await act(async () => {
    renderer = create(
      <Provider store={store}>
        <PortalProvider>
          <ExportPrivacyKeys
            navigation={navigation}
            route={{ key: 'ExportPrivacyKeys-test', name: 'ExportPrivacyKeys' }}
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
  const press = (title, index = 0) => act(async () => {
    renderer.root.findAll(
      (node) => node.props.title === title && typeof node.props.onPress === 'function',
    )[index].props.onPress();
  });
  /** Acknowledges the warning and enters the PIN, as the PIN screen calls back with it. */
  const exportWithPin = async (pin = PIN) => {
    await press(EXPORT);
    const [, params] = navigation.navigate.mock.calls[navigation.navigate.mock.calls.length - 1];
    await act(async () => { await params.cb(pin); });
  };
  return {
    store,
    renderer,
    navigation,
    listeners,
    onAppState,
    texts,
    titles,
    press,
    exportWithPin,
  };
}

// How the screen closes, with its PIN screen, when the shielded UI stops being available is tested
// in a real stack, in PrivacyScreensStack.test.js.
describe('ExportPrivacyKeys', () => {
  test('shows the warning first, and reads nothing until it is acknowledged', async () => {
    const wallet = fakeWallet();
    const { texts, titles } = await render({ wallet });

    expect(texts()).toEqual(expect.arrayContaining([
      'EXPORT PRIVACY KEYS',
      'Read this before you export',
      'These keys give read access to every private output this wallet receives, its change included: whoever holds them sees the amount and the token of each one.',
      "This access can't be revoked. To end it, move your funds to a new wallet.",
      "The keys can't spend: they don't move funds or sign transactions.",
      "Share them only with an auditor you trust, over a secure channel. The auditor needs a tool that reads Hathor's private outputs.",
    ]));
    expect(titles()).toContain(EXPORT);
    expect(wallet.getShieldedCapability).not.toHaveBeenCalled();
    expect(wallet.storage.getSpendXPubKey).not.toHaveBeenCalled();
    expect(wallet.storage.getScanXPrivKey).not.toHaveBeenCalled();
  });

  test('asks for the PIN on the PIN screen, whose params carry no PIN and no key', async () => {
    const { navigation, press } = await render();

    await press(EXPORT);

    expect(navigation.navigate).toHaveBeenCalledTimes(1);
    const [route, params] = navigation.navigate.mock.calls[0];
    expect(route).toBe('PinScreen');
    expect(params).toEqual({
      cb: expect.any(Function),
      canCancel: true,
      screenText: 'Enter your 6-digit pin to export the privacy keys',
      biometryText: 'Export privacy keys',
    });
  });

  test('checks the capability, then reads the keys with the PIN the PIN screen gives', async () => {
    const wallet = fakeWallet();
    const { exportWithPin } = await render({ wallet });

    await exportWithPin();

    expect(wallet.storage.getScanXPrivKey).toHaveBeenCalledWith(PIN);
    expect(wallet.storage.getSpendXPubKey).toHaveBeenCalledTimes(1);
    const checked = wallet.getShieldedCapability.mock.invocationCallOrder[0];
    expect(checked).toBeLessThan(wallet.storage.getScanXPrivKey.mock.invocationCallOrder[0]);
    expect(checked).toBeLessThan(wallet.storage.getSpendXPubKey.mock.invocationCallOrder[0]);
  });

  test('shows each key masked, never in full, and never selectable', async () => {
    const { renderer, texts, exportWithPin } = await render();

    await exportWithPin();

    expect(texts()).toEqual(expect.arrayContaining([
      'Spend public key (xpub)',
      "Path m/44'/280'/2'/0. It finds the private outputs this wallet receives.",
      SPEND_MASKED,
      'Scan private key (xpriv)',
      "Path m/44'/280'/1'/0. It reads the amount and the token of each private output this wallet receives. It never signs.",
      SCAN_MASKED,
    ]));
    const tree = JSON.stringify(renderer.toJSON());
    expect(tree).not.toContain(SPEND_XPUB);
    expect(tree).not.toContain(SCAN_XPRIV);
    expect(renderer.root.findAll((node) => node.type === 'Text' && node.props.selectable))
      .toEqual([]);
  });

  test('copies a key in full, and the clipboard clears a minute later', async () => {
    const { texts, press, exportWithPin } = await render();
    await exportWithPin();
    jest.useFakeTimers();

    // The scan key's card is the second one.
    await press('Copy', 1);

    expect(Clipboard.setString.mock.calls).toEqual([[SCAN_XPRIV]]);
    expect(texts()).toContain(COPIED);

    await act(async () => { jest.advanceTimersByTime(SENSITIVE_CLIPBOARD_CLEAR_MS); });
    expect(Clipboard.setString.mock.calls).toEqual([[SCAN_XPRIV], ['']]);
  });

  test('says that the clipboard clears for a few seconds, long before it clears', async () => {
    const { texts, press, exportWithPin } = await render();
    await exportWithPin();
    jest.useFakeTimers();

    await press('Copy', 1);
    await act(async () => { jest.advanceTimersByTime(SENSITIVE_COPY_FEEDBACK_MS - 1); });
    expect(texts()).toContain(COPIED);

    await act(async () => { jest.advanceTimersByTime(1); });
    expect(texts()).not.toContain(COPIED);
    // The key is still in the clipboard.
    expect(Clipboard.setString.mock.calls).toEqual([[SCAN_XPRIV]]);

    await act(async () => { jest.advanceTimersByTime(SENSITIVE_CLIPBOARD_CLEAR_MS); });
    expect(Clipboard.setString.mock.calls).toEqual([[SCAN_XPRIV], ['']]);
    expect(texts()).not.toContain(COPIED);
  });

  test('keeps the note for a few seconds from the last copy, on the key copied last', async () => {
    const { texts, press, exportWithPin } = await render();
    await exportWithPin();
    jest.useFakeTimers();

    await press('Copy', 0);
    await act(async () => { jest.advanceTimersByTime(SENSITIVE_COPY_FEEDBACK_MS - 1); });
    await press('Copy', 1);
    await act(async () => { jest.advanceTimersByTime(SENSITIVE_COPY_FEEDBACK_MS - 1); });
    expect(texts().filter((text) => text === COPIED)).toHaveLength(1);
    // The scan key's card, the second one, holds the note.
    expect(texts().indexOf(COPIED)).toBeGreaterThan(texts().indexOf(SCAN_MASKED));

    await act(async () => { jest.advanceTimersByTime(1); });
    expect(texts()).not.toContain(COPIED);
  });

  test('hides the keys while the app is not active', async () => {
    const { texts, onAppState, exportWithPin } = await render();
    await exportWithPin();

    await act(async () => { onAppState('inactive'); });
    expect(texts()).not.toContain(SCAN_MASKED);
    expect(texts()).not.toContain(SPEND_MASKED);

    await act(async () => { onAppState('background'); });
    expect(texts()).not.toContain(SCAN_MASKED);

    await act(async () => { onAppState('active'); });
    expect(texts()).toEqual(expect.arrayContaining([SPEND_MASKED, SCAN_MASKED]));
  });

  test('drops the keys when the screen loses focus', async () => {
    const { texts, titles, listeners, exportWithPin } = await render();
    await exportWithPin();
    expect(texts()).toContain(SCAN_MASKED);

    await act(async () => { listeners.blur(); });

    expect(texts()).not.toContain(SCAN_MASKED);
    expect(texts()).not.toContain(SPEND_MASKED);
    expect(titles()).toContain(EXPORT);
  });

  test('drops the keys when the lock screen comes up', async () => {
    const { store, texts, exportWithPin } = await render();
    await exportWithPin();

    await act(async () => { store.dispatch(lockScreen()); });
    await act(async () => { store.dispatch(unlockScreen()); });

    expect(texts()).not.toContain(SCAN_MASKED);
    expect(texts()).not.toContain(SPEND_MASKED);
  });

  test('drops the keys a read returns after the screen lost focus', async () => {
    const wallet = fakeWallet();
    let respond;
    wallet.storage.getScanXPrivKey.mockImplementation(
      () => new Promise((resolve) => { respond = resolve; }),
    );
    const { texts, listeners, navigation, press } = await render({ wallet });
    await press(EXPORT);
    const [, params] = navigation.navigate.mock.calls[0];
    let read;
    await act(async () => { read = params.cb(PIN); });

    await act(async () => { listeners.blur(); });
    await act(async () => {
      respond(SCAN_XPRIV);
      await read;
    });

    expect(texts()).not.toContain(SCAN_MASKED);
    expect(texts()).not.toContain(SPEND_MASKED);
  });

  test('keeps no PIN and no key in the redux state', async () => {
    const { store, exportWithPin } = await render();

    await exportWithPin();

    // The state holds the wallet itself, the fake whose methods return the keys.
    const json = JSON.stringify(store.getState(), (key, value) => {
      if (key === 'wallet') return undefined;
      return typeof value === 'bigint' ? value.toString() : value;
    });
    expect(json).not.toContain(PIN);
    expect(json).not.toContain(SCAN_XPRIV);
    expect(json).not.toContain(SPEND_XPUB);
  });

  test('stops before it decrypts when the wallet no longer decodes its private outputs', async () => {
    const wallet = fakeWallet({ live: capability('watch') });
    const { texts, exportWithPin } = await render({ wallet });

    await exportWithPin();

    expect(wallet.storage.getScanXPrivKey).not.toHaveBeenCalled();
    expect(texts()).toContain(READ_FAILED);
  });

  test('shows a fixed text when the wallet has no spend xpub', async () => {
    const wallet = fakeWallet();
    wallet.storage.getSpendXPubKey.mockResolvedValue(undefined);
    const { texts, exportWithPin } = await render({ wallet });

    await exportWithPin();

    expect(texts()).toContain(READ_FAILED);
    expect(texts()).not.toContain(SCAN_MASKED);
  });

  test('decrypts nothing when the PIN screen calls back after the screen went away', async () => {
    const wallet = fakeWallet();
    const { navigation, press } = await render({ wallet });
    await press(EXPORT);
    const [, params] = navigation.navigate.mock.calls[0];

    await act(async () => { mounted.unmount(); });
    mounted = null;
    await act(async () => { await params.cb(PIN); });

    expect(wallet.getShieldedCapability).not.toHaveBeenCalled();
    expect(wallet.storage.getScanXPrivKey).not.toHaveBeenCalled();
  });

  test('shows a fixed text when a key cannot be read, and logs nothing', async () => {
    const wallet = fakeWallet();
    const leak = `wrong password for ${PIN}`;
    wallet.storage.getScanXPrivKey.mockRejectedValue(new errors.InvalidPasswdError(leak));
    const consoleSpies = ['log', 'debug', 'info', 'warn', 'error']
      .map((method) => jest.spyOn(console, method));
    const { renderer, texts, titles, exportWithPin } = await render({ wallet });

    await exportWithPin();

    expect(texts()).toContain(READ_FAILED);
    expect(titles()).toContain(EXPORT);
    expect(JSON.stringify(renderer.toJSON())).not.toContain(leak);
    const logged = JSON.stringify(consoleSpies.flatMap((spy) => spy.mock.calls), (_key, value) => (
      value instanceof Error ? value.message : value
    ));
    expect(logged).not.toContain(leak);
    expect(logged).not.toContain(PIN);
    expect(logged).not.toContain(SPEND_XPUB);
  });

  test('asks to unlock a locked private balance before the export', async () => {
    const { texts, titles } = await render({ level: capability('watch') });

    expect(texts()).toContain('Unlock your private balance to export the privacy keys.');
    expect(titles()).toContain('Unlock private balance');
    expect(titles()).not.toContain(EXPORT);
  });

  test.each([
    ['a scan key no PIN can unlock', capability('watch', { cause: 'corrupt-key' })],
    ['shielded keys that do not match', capability('none', { reason: 'integrity', cause: 'key-mismatch' })],
  ])('offers no export for %s', async (_label, level) => {
    const { texts, titles } = await render({ level });

    expect(texts()).toContain('Private transfers are not available for this wallet.');
    expect(titles()).not.toContain(EXPORT);
    expect(titles()).not.toContain('Unlock private balance');
  });
});
