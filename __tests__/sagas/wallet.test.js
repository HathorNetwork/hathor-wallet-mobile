import { jest, describe, test, expect, afterEach, beforeEach } from '@jest/globals';

// HathorWallet stands in for the fullnode-facade wallet: it records the calls startWallet makes,
// in order, in HathorWallet.log, and start() waits until a test settles it.
jest.mock('@hathor/wallet-lib', () => {
  const actual = jest.requireActual('@hathor/wallet-lib');
  const { EventEmitter } = jest.requireActual('events');

  class MockHathorWallet extends EventEmitter {
    constructor(config = {}) {
      super();
      this.config = config;
      this.storage = config.storage;
      this.conn = config.connection ?? new EventEmitter();
      MockHathorWallet.instances.push(this);
    }

    // eslint-disable-next-line class-methods-use-this
    record(entry) {
      MockHathorWallet.log.push(entry);
    }

    setHistorySyncMode(mode) {
      this.record(`setHistorySyncMode:${mode}`);
    }

    setShieldedCryptoProvider() {
      this.record('setShieldedCryptoProvider');
    }

    setExternalTxSigningMethod() {
      this.record('setExternalTxSigningMethod');
    }

    start() {
      this.record('start');
      return MockHathorWallet.onStart(this);
    }

    // eslint-disable-next-line class-methods-use-this
    isReady() {
      return true;
    }
  }
  MockHathorWallet.ERROR = actual.HathorWallet.ERROR;
  MockHathorWallet.log = [];
  MockHathorWallet.instances = [];
  MockHathorWallet.onStart = () => new Promise(() => {});

  class MockConnection extends EventEmitter {
    constructor(options) {
      super();
      this.options = options;
    }
  }

  return { ...actual, HathorWallet: MockHathorWallet, Connection: MockConnection };
});

jest.mock('../../src/sagas/shieldedProvider', () => ({
  registerShieldedCryptoProvider: jest.fn(),
}));

// startWallet refreshes the Unleash client; these tests set the toggles in the state instead.
jest.mock('../../src/sagas/featureToggle', () => ({
  ...jest.requireActual('../../src/sagas/featureToggle'),
  monitorFeatureFlags: jest.fn(),
}));

/* eslint-disable import/first */
import { runSaga, stdChannel } from 'redux-saga';
import { call } from 'redux-saga/effects';
import { HathorWallet, HistorySyncMode } from '@hathor/wallet-lib';
import { isWalletServiceEnabled, startWallet, waitForWalletRestart } from '../../src/sagas/wallet';
import { registerShieldedCryptoProvider } from '../../src/sagas/shieldedProvider';
import {
  reloadWalletRequested,
  resetWallet,
  setUseWalletService,
  startWalletRequested,
  types,
  walletPinChanged,
} from '../../src/actions';
import {
  FEATURE_TOGGLE_DEFAULTS,
  PRE_SETTINGS_MAINNET,
  PRE_SETTINGS_SHIELDED_TESTNET,
  PRE_SETTINGS_TESTNET,
  SHIELDED_OUTPUTS_FEATURE_TOGGLE,
  WALLET_SERVICE_FEATURE_TOGGLE,
  networkSettingsKeyMap,
} from '../../src/constants';
import { STORE } from '../../src/store';
/* eslint-enable import/first */

describe('startWallet saga', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  // Regression guard for the passkey-core fix: the passkey start paths (onboarding +
  // unlock) dispatch startWalletRequested() with NO argument and read everything from the
  // persisted walletMeta. Before `action.payload ?? {}` was added, destructuring
  // `action.payload` (undefined) threw synchronously before startup — a crash that slipped
  // through an approved review unnoticed.
  test('does not crash when a passkey wallet is started with no payload', () => {
    jest.spyOn(STORE, 'getWalletMeta').mockReturnValue({
      walletType: 'passkey',
      xpub: 'xpub-passkey-wallet',
      passkeyLabel: 'My passkey',
    });
    // getStorage is the first thing used after the metadata branch; stub the pieces the
    // saga touches up to its first yield (cleaning memory metadata and transaction history).
    jest.spyOn(STORE, 'getStorage').mockReturnValue({
      store: { cleanMetadata: jest.fn() },
      cleanStorage: jest.fn(),
    });

    const action = startWalletRequested(); // no payload
    expect(action.payload).toBeUndefined();

    const gen = startWallet(action);

    // Running the generator to its first yield executes the payload destructure and the
    // passkey-metadata branch; with the fix it must not throw, and the saga keeps going.
    let step;
    expect(() => {
      step = gen.next();
    }).not.toThrow();
    expect(step.done).toBe(false);
  });
});

const WORDS = 'seed words';
const PIN = '111111';
const PASSKEY_META = { walletType: 'passkey', xpub: 'xpub-passkey-wallet' };
// The Customize form saves the network name the node reports, and may add a wallet-service.
const CUSTOM_SHIELDED_NETWORK = {
  ...PRE_SETTINGS_SHIELDED_TESTNET,
  walletServiceUrl: 'https://wallet-service.example/',
  walletServiceWsUrl: 'wss://ws.wallet-service.example/',
};

/**
 * Stubs what startWallet reads before it starts the wallet: the stored network settings and
 * wallet metadata, a fresh storage, and the feature toggles in the state.
 */
function stubStart({ networkSettings, walletMeta = null, featureToggles = {} }) {
  jest.spyOn(STORE, 'getWalletMeta').mockReturnValue(walletMeta);
  jest.spyOn(STORE, 'getStorage').mockReturnValue({
    store: { cleanMetadata: jest.fn() },
    cleanStorage: jest.fn(),
  });
  jest.spyOn(STORE, 'getItem').mockImplementation(
    (key) => (key === networkSettingsKeyMap.networkSettings ? networkSettings : null),
  );
  jest.spyOn(STORE, 'setItem').mockImplementation(() => {});
  return () => ({
    featureTogglesInitialized: true,
    featureToggles: { ...FEATURE_TOGGLE_DEFAULTS, ...featureToggles },
    networkSettings,
  });
}

/**
 * Runs startWallet until it calls wallet.start(), then cancels it. Returns HathorWallet.log, where
 * the dispatched actions are recorded too, and the wallet.
 */
async function runUntilStart(options) {
  const getState = stubStart(options);
  let started;
  const startCalled = new Promise((resolve) => { started = resolve; });
  HathorWallet.onStart = () => {
    started();
    return new Promise(() => {});
  };
  const task = runSaga(
    {
      channel: stdChannel(),
      dispatch: (action) => {
        if (action?.type) HathorWallet.log.push(`dispatch:${action.type}`);
      },
      getState,
    },
    startWallet,
    startWalletRequested({ words: WORDS, pin: PIN }),
  );
  const ended = task.toPromise().then(() => {
    throw new Error('startWallet ended before it called wallet.start()');
  });
  await Promise.race([startCalled, ended]);
  task.cancel();
  const wallet = HathorWallet.instances[HathorWallet.instances.length - 1];
  return { log: HathorWallet.log, wallet };
}

describe('startWallet on the fullnode facade', () => {
  const PROVIDER = { name: 'mobile shielded crypto provider' };

  beforeEach(() => {
    HathorWallet.log = [];
    HathorWallet.instances = [];
    registerShieldedCryptoProvider.mockReset();
    registerShieldedCryptoProvider.mockImplementation(function* register(wallet) {
      yield call([wallet, wallet.setShieldedCryptoProvider], PROVIDER);
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  const indexOf = (log, entry) => {
    const index = log.indexOf(entry);
    expect(index).toBeGreaterThanOrEqual(0);
    return index;
  };

  test.each([
    ['off', false],
    ['on', true],
  ])('registers the crypto provider on the shielded testnet with the flag %s, before start()', async (_label, flag) => {
    const { log, wallet } = await runUntilStart({
      networkSettings: PRE_SETTINGS_SHIELDED_TESTNET,
      featureToggles: { [SHIELDED_OUTPUTS_FEATURE_TOGGLE]: flag },
    });

    expect(registerShieldedCryptoProvider).toHaveBeenCalledTimes(1);
    expect(registerShieldedCryptoProvider).toHaveBeenCalledWith(wallet);
    const syncMode = indexOf(log, `setHistorySyncMode:${HistorySyncMode.POLLING_HTTP_API}`);
    const provider = indexOf(log, 'setShieldedCryptoProvider');
    const setWallet = indexOf(log, `dispatch:${types.SET_WALLET}`);
    const start = indexOf(log, 'start');
    expect(syncMode).toBeLessThan(provider);
    expect(provider).toBeLessThan(setWallet);
    expect(setWallet).toBeLessThan(start);
  });

  test('registers it with the wallet-service flag on and a wallet-service URL', async () => {
    const { log } = await runUntilStart({
      networkSettings: CUSTOM_SHIELDED_NETWORK,
      featureToggles: { [WALLET_SERVICE_FEATURE_TOGGLE]: true },
    });

    expect(registerShieldedCryptoProvider).toHaveBeenCalledTimes(1);
    expect(log).toContain('start');
  });

  test.each([
    ['mainnet', PRE_SETTINGS_MAINNET],
    ['the public testnet', PRE_SETTINGS_TESTNET],
  ])('registers no provider on %s, and still syncs by polling', async (_label, networkSettings) => {
    const { log } = await runUntilStart({ networkSettings });

    expect(registerShieldedCryptoProvider).not.toHaveBeenCalled();
    expect(log).not.toContain('setShieldedCryptoProvider');
    expect(indexOf(log, `setHistorySyncMode:${HistorySyncMode.POLLING_HTTP_API}`))
      .toBeLessThan(indexOf(log, 'start'));
  });

  test('registers no provider for a passkey wallet on the shielded testnet', async () => {
    const { log } = await runUntilStart({
      networkSettings: PRE_SETTINGS_SHIELDED_TESTNET,
      walletMeta: PASSKEY_META,
    });

    expect(registerShieldedCryptoProvider).not.toHaveBeenCalled();
    expect(log).toContain('setExternalTxSigningMethod');
    expect(log).toContain('start');
  });
});

describe('isWalletServiceEnabled', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  async function run(options) {
    const getState = stubStart(options);
    const dispatched = [];
    const result = await runSaga(
      { dispatch: (action) => dispatched.push(action), getState },
      isWalletServiceEnabled,
    ).toPromise();
    return { result, dispatched };
  }

  test('keeps the shielded testnet on the fullnode facade, whatever the flag and URL', async () => {
    const { result, dispatched } = await run({
      networkSettings: CUSTOM_SHIELDED_NETWORK,
      featureToggles: { [WALLET_SERVICE_FEATURE_TOGGLE]: true },
    });

    expect(result).toBe(false);
    expect(dispatched).toEqual([setUseWalletService(false)]);
  });

  test('still follows the flag on another network with a wallet-service URL', async () => {
    const { result } = await run({
      networkSettings: PRE_SETTINGS_TESTNET,
      featureToggles: { [WALLET_SERVICE_FEATURE_TOGGLE]: true },
    });

    expect(result).toBe(true);
  });
});

describe('waitForWalletRestart', () => {
  const startAction = startWalletRequested({ words: 'seed words', pin: '111111' });

  // Runs the saga for a wallet started with startAction, then dispatches `actions` to it in order.
  async function run(actions) {
    const channel = stdChannel();
    const dispatched = [];
    const task = runSaga(
      { channel, dispatch: (action) => dispatched.push(action) },
      waitForWalletRestart,
      startAction,
    );
    actions.forEach((action) => channel.put(action));
    await task.toPromise();
    return dispatched;
  }

  test('starts the wallet again with the same action on a reload', async () => {
    expect(await run([reloadWalletRequested()])).toEqual([startAction]);
  });

  // ChangePin and the safe-biometry switch re-encrypt the access data of the running wallet, and
  // start() decrypts it with the PIN it is given.
  test('starts the wallet again with the PIN of the last PIN change on a reload', async () => {
    const dispatched = await run([
      walletPinChanged('222222'),
      walletPinChanged('random-password'),
      reloadWalletRequested(),
    ]);
    expect(dispatched).toEqual([
      startWalletRequested({ words: 'seed words', pin: 'random-password' }),
    ]);
  });

  test('ends without starting the wallet on a new start request or a wallet reset', async () => {
    expect(await run([
      walletPinChanged('222222'),
      startWalletRequested({ words: 'other words', pin: '333333' }),
    ])).toEqual([]);
    expect(await run([resetWallet()])).toEqual([]);
  });
});
