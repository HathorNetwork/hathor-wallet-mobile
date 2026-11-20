/**
 * Copyright (c) Hathor Labs and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { jest, describe, test, expect, beforeEach, afterEach } from '@jest/globals';

// With the flags off, the Hathor Next code, and the crypto library only it uses (@noble), are
// never evaluated: not by the multichain saga, the address screen, the QR scanners nor the unlock.
// Each @noble module records itself as it is evaluated. Every test loads the app's modules anew.

const NOBLE = [
  '@noble/curves/ed25519',
  '@noble/hashes/blake3',
  '@noble/hashes/hmac',
  '@noble/hashes/pbkdf2',
  '@noble/hashes/sha512',
  '@noble/hashes/utils',
];

const mockNavigation = {
  navigate: jest.fn(), goBack: jest.fn(), popTo: jest.fn(), replace: jest.fn(),
};
jest.mock('@react-navigation/native', () => ({
  ...jest.requireActual('@react-navigation/native'),
  useNavigation: () => mockNavigation,
  useRoute: () => ({ params: {} }),
}));
jest.mock('react-native-status-bar-height', () => ({ getStatusBarHeight: () => 20 }));
// The camera isn't available in tests: the reader is a stub the test calls onSuccess of.
jest.mock('../../src/components/QRCodeReader', () => () => null);

// A testnet address built with wallet-lib's address encoders from fixed keys.
const P2PKH = 'Wa9Q77VagNbzfecxW6g56jBuetkgEYyxoh';

const evaluated = [];
let mounted = null;

beforeEach(() => {
  jest.resetModules();
  // bitcore-lib refuses a second instance of itself by a global it sets as it loads: each test
  // loads it anew.
  delete global._bitcore; // eslint-disable-line no-underscore-dangle
  evaluated.length = 0;
  for (const name of NOBLE) {
    jest.doMock(name, () => {
      evaluated.push(name);
      return jest.requireActual(name);
    });
  }
});

afterEach(async () => {
  if (mounted) {
    const { act } = require('react-test-renderer'); // eslint-disable-line global-require
    await act(async () => { mounted.unmount(); });
    mounted = null;
  }
  jest.clearAllMocks();
});

/* eslint-disable global-require */
// The app's modules, loaded after the recorders are in place.
function load() {
  return {
    React: require('react'),
    renderer: require('react-test-renderer'),
    Provider: require('react-redux').Provider,
    createStore: require('redux').legacy_createStore,
    reducer: require('../../src/reducers/reducer').reducer,
    actions: require('../../src/actions'),
    constants: require('../../src/constants'),
  };
}
/* eslint-enable global-require */

const wait = (ms) => new Promise((resolve) => { setTimeout(resolve, ms); });

describe('with the flags off', () => {
  test('the multichain saga answers the flags, and a wallet start, without it', async () => {
    const { reducer, actions, constants } = load();
    const { runSaga, stdChannel } = require('redux-saga'); // eslint-disable-line global-require
    const { saga } = require('../../src/sagas/multichain'); // eslint-disable-line global-require
    let state = reducer(undefined, { type: '@@INIT' });
    const channel = stdChannel();
    const dispatch = (action) => {
      state = reducer(state, action);
      channel.put(action);
    };
    const task = runSaga({ channel, dispatch, getState: () => state }, saga);
    try {
      dispatch(actions.networkSettingsUpdateState(constants.PRE_SETTINGS_MAINNET));
      dispatch(actions.setFeatureToggles({ [constants.MULTICHAIN_FEATURE_TOGGLE]: false }));
      dispatch(actions.featureToggleInitialized());
      dispatch(actions.startWalletSuccess());
      dispatch(actions.setFeatureToggles({ [constants.MULTICHAIN_FEATURE_TOGGLE]: false }));
      await wait(50);
    } finally {
      task.cancel();
    }
    expect(evaluated).toEqual([]);
  });

  test('the address screen takes a Hathor Network address, typed and validated, without it', async () => {
    const { React, renderer, Provider, createStore, reducer, actions, constants } = load();
    // eslint-disable-next-line global-require
    const SendAddressInput = require('../../src/screens/SendAddressInput').default;
    const { TextInput } = require('react-native'); // eslint-disable-line global-require
    const store = createStore(reducer);
    store.dispatch(actions.networkSettingsUpdateState(constants.PRE_SETTINGS_TESTNET));
    await renderer.act(async () => {
      mounted = renderer.create(
        React.createElement(Provider, { store }, React.createElement(SendAddressInput)),
      );
    });
    await renderer.act(async () => {
      mounted.root.findByType(TextInput).props.onChangeText(P2PKH);
    });
    const next = mounted.root.find(
      (node) => node.props.title === 'Next' && typeof node.props.onPress === 'function',
    );
    await renderer.act(async () => { next.props.onPress(); });
    expect(mockNavigation.navigate).toHaveBeenCalledWith('SendAmountInput', { address: P2PKH });
    expect(evaluated).toEqual([]);
  });

  // Send's scanner reads a Hathor Network address; the Dashboard's, a token's registration code.
  const TOKEN_CODE = `[My Token:MTK:${'ab'.repeat(32)}:abcd1234]`;
  test.each([
    ['the send scanner', 'SendScanQRCode', `hathor:${P2PKH}`, P2PKH],
    ['the Dashboard scanner', 'UnifiedQRScanner', TOKEN_CODE, TOKEN_CODE],
  ])('%s reads a code without it', async (_label, screen, data, handedOn) => {
    const { React, renderer, Provider, createStore, reducer, actions, constants } = load();
    // eslint-disable-next-line global-require, import/no-dynamic-require
    const Screen = require(`../../src/screens/${screen}`).default;
    // eslint-disable-next-line global-require
    const QRCodeReader = require('../../src/components/QRCodeReader');
    const store = createStore(reducer);
    store.dispatch(actions.networkSettingsUpdateState(constants.PRE_SETTINGS_TESTNET));
    await renderer.act(async () => {
      mounted = renderer.create(React.createElement(
        Provider,
        { store },
        React.createElement(Screen, { navigation: mockNavigation }),
      ));
    });
    await renderer.act(async () => {
      await mounted.root.findByType(QRCodeReader).props.onSuccess({ data });
    });
    // The scan went on, with what it read.
    const moves = ['navigate', 'popTo', 'replace'].flatMap((how) => mockNavigation[how].mock.calls);
    expect(JSON.stringify(moves)).toContain(JSON.stringify(handedOn).slice(1, -1));
    expect(evaluated).toEqual([]);
  });

  test('the unlock derives no Hathor Next keys, and loads none of it', async () => {
    load();
    // eslint-disable-next-line global-require
    const { prepareNextKeysAtUnlock } = require('../../src/multichain/keys');
    require('../../src/screens/PasskeyLockScreen'); // eslint-disable-line global-require
    await expect(prepareNextKeysAtUnlock('abandon ability able', false)).resolves.toBeNull();
    expect(evaluated).toEqual([]);
  });
});

// So an empty list above means something: the recorders do see the Hathor Next code load.
describe('once Hathor Next is used', () => {
  test('its client and its address helpers load it', () => {
    load();
    // eslint-disable-next-line global-require
    const { ensureNextClient, setNextClient } = require('../../src/multichain/nextClient');
    ensureNextClient();
    setNextClient(null);
    expect(evaluated).toEqual(expect.arrayContaining(['@noble/curves/ed25519']));
  });

  test('an address helper reading a Hathor Next address loads it', () => {
    load();
    // eslint-disable-next-line global-require
    const { isNextAddress } = require('../../src/multichain/address');
    expect(evaluated).toEqual([]);
    expect(isNextAddress(`samba1z${'q'.repeat(40)}`)).toBe(false);
    expect(evaluated).toEqual(expect.arrayContaining(['@noble/curves/ed25519']));
  });
});
