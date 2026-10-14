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

    setExternalTxSigningMethod(method, options) {
      this.record('setExternalTxSigningMethod');
      this.externalTxSigningOptions = options;
    }

    start(options) {
      this.record('start');
      this.startOptions = options;
      return MockHathorWallet.onStart(this);
    }

    getShieldedCapability() {
      this.record('getShieldedCapability');
      return Promise.resolve(MockHathorWallet.capability);
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
  MockHathorWallet.capability = null;

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

// The passkey wallet's shielded keys: its stored xpubs are read from the metadata the test sets,
// and the scan key held for the session is set by each test.
jest.mock('../../src/passkey/shieldedKeys', () => ({
  getPasskeyShieldedXpubs: jest.fn((walletMeta) => walletMeta?.shieldedXpubs ?? null),
  getPasskeyScanKey: jest.fn(() => null),
  syncPasskeyShieldedAccessData: jest.fn(async () => false),
  clearPasskeyScanKey: jest.fn(),
}));

// startWallet refreshes the Unleash client; these tests set the toggles in the state instead.
jest.mock('../../src/sagas/featureToggle', () => ({
  ...jest.requireActual('../../src/sagas/featureToggle'),
  monitorFeatureFlags: jest.fn(),
}));

/* eslint-disable import/first */
import { runSaga, stdChannel } from 'redux-saga';
import { call, take } from 'redux-saga/effects';
import { HathorWallet, HistorySyncMode, SCANNING_POLICY } from '@hathor/wallet-lib';
import {
  isWalletServiceEnabled,
  onStartWalletFailed,
  saga,
  setupWalletListeners,
  startWallet,
  trackRestartPin,
  waitForWalletRestart,
} from '../../src/sagas/wallet';
import { registerShieldedCryptoProvider } from '../../src/sagas/shieldedProvider';
import {
  clearPasskeyScanKey,
  getPasskeyScanKey,
  syncPasskeyShieldedAccessData,
} from '../../src/passkey/shieldedKeys';
import {
  onExceptionCaptured,
  reloadWalletRequested,
  resetWallet,
  setUseWalletService,
  setWallet,
  shieldedCapabilityUpdate,
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
const PASSKEY_SHIELDED_XPUBS = { scanXpubkey: 'xpub-scan', spendXpubkey: 'xpub-spend' };
const PASSKEY_SHIELDED_META = { ...PASSKEY_META, shieldedXpubs: PASSKEY_SHIELDED_XPUBS };
const PASSKEY_SCAN_KEY = 'xprv-scan-key';
const PROVIDER = { name: 'mobile shielded crypto provider' };
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
    getScanningPolicy: jest.fn(async () => SCANNING_POLICY.GAP_LIMIT),
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
 * Runs startWallet until `until` is recorded in HathorWallet.log, where the types of the
 * dispatched actions are recorded too, then cancels it. By default the wallet's start() never
 * settles and the run stops there.
 */
async function runStartWallet(options, until = 'start') {
  const getState = stubStart(options);
  let reached;
  const untilReached = new Promise((resolve) => { reached = resolve; });
  const log = [];
  const dispatched = [];
  HathorWallet.log = {
    push: (entry) => {
      log.push(entry);
      if (entry === until) reached();
    },
  };
  const task = runSaga(
    {
      channel: stdChannel(),
      dispatch: (action) => {
        if (!action?.type) return;
        dispatched.push(action);
        HathorWallet.log.push(`dispatch:${action.type}`);
      },
      getState,
    },
    startWallet,
    startWalletRequested({ words: WORDS, pin: PIN }),
  );
  const ended = task.toPromise().then(() => {
    throw new Error(`startWallet ended before ${until}`);
  });
  await Promise.race([untilReached, ended]);
  task.cancel();
  const wallet = HathorWallet.instances[HathorWallet.instances.length - 1];
  return { log, dispatched, wallet };
}

const runUntilStart = (options) => runStartWallet(options);

describe('startWallet on the fullnode facade', () => {
  beforeEach(() => {
    HathorWallet.log = [];
    HathorWallet.instances = [];
    HathorWallet.onStart = () => new Promise(() => {});
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
    const walletSet = indexOf(log, `dispatch:${types.SET_WALLET}`);
    const start = indexOf(log, 'start');
    expect(syncMode).toBeLessThan(provider);
    expect(provider).toBeLessThan(walletSet);
    expect(walletSet).toBeLessThan(start);
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

describe('startWallet for a passkey wallet with shielded keys', () => {
  beforeEach(() => {
    HathorWallet.log = [];
    HathorWallet.instances = [];
    HathorWallet.onStart = () => new Promise(() => {});
    registerShieldedCryptoProvider.mockReset();
    registerShieldedCryptoProvider.mockImplementation(function* register(wallet) {
      yield call([wallet, wallet.setShieldedCryptoProvider], PROVIDER);
    });
    getPasskeyScanKey.mockReset();
    getPasskeyScanKey.mockReturnValue(null);
    syncPasskeyShieldedAccessData.mockReset();
    syncPasskeyShieldedAccessData.mockImplementation(async () => {
      HathorWallet.log.push('syncPasskeyShieldedAccessData');
      return true;
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('registers the provider and starts with the scan key held for the session', async () => {
    getPasskeyScanKey.mockReturnValue(PASSKEY_SCAN_KEY);

    const { log, wallet } = await runUntilStart({
      networkSettings: PRE_SETTINGS_SHIELDED_TESTNET,
      walletMeta: PASSKEY_SHIELDED_META,
    });

    expect(registerShieldedCryptoProvider).toHaveBeenCalledWith(wallet);
    expect(syncPasskeyShieldedAccessData)
      .toHaveBeenCalledWith(expect.anything(), PASSKEY_SHIELDED_META);
    expect(log.indexOf('syncPasskeyShieldedAccessData')).toBeGreaterThanOrEqual(0);
    expect(log.indexOf('syncPasskeyShieldedAccessData')).toBeLessThan(log.indexOf('start'));
    expect(log.indexOf('setShieldedCryptoProvider')).toBeLessThan(log.indexOf('start'));
    expect(wallet.startOptions).toEqual({ shieldedScanXPrivKey: PASSKEY_SCAN_KEY });
    // The signer signs the inputs that spend shielded outputs too: without it the wallet never
    // reaches level full.
    expect(wallet.externalTxSigningOptions).toEqual({ shieldedSpend: true });
  });

  // It starts with its shielded outputs locked, and a passkey ceremony unlocks them.
  test('still registers the provider without a scan key, and starts without one', async () => {
    const { wallet } = await runUntilStart({
      networkSettings: PRE_SETTINGS_SHIELDED_TESTNET,
      walletMeta: PASSKEY_SHIELDED_META,
    });

    expect(registerShieldedCryptoProvider).toHaveBeenCalledWith(wallet);
    expect(wallet.startOptions).toEqual({});
  });

  test('passes no scan key where it gets no shielded chain', async () => {
    getPasskeyScanKey.mockReturnValue(PASSKEY_SCAN_KEY);

    const { wallet } = await runUntilStart({
      networkSettings: PRE_SETTINGS_TESTNET,
      walletMeta: PASSKEY_SHIELDED_META,
    });

    expect(registerShieldedCryptoProvider).not.toHaveBeenCalled();
    expect(wallet.startOptions).toEqual({});
  });

  test('reports a failed access data sync, and starts the wallet anyway', async () => {
    const failure = new Error('bad xpub');
    syncPasskeyShieldedAccessData.mockRejectedValue(failure);
    jest.spyOn(console, 'error').mockImplementation(() => {});

    const { log, dispatched } = await runUntilStart({
      networkSettings: PRE_SETTINGS_SHIELDED_TESTNET,
      walletMeta: PASSKEY_SHIELDED_META,
    });

    expect(dispatched).toContainEqual(onExceptionCaptured(failure, false));
    expect(log).toContain('start');
  });
});

const CAPABILITY = {
  level: 'watch',
  reason: 'locked',
  cause: 'wrong-pin',
  canReceive: false,
  canSpend: false,
  historyComplete: true,
  undecoded: { txIds: ['tx1'], locked: 1, unreadable: 0, error: 0 },
};

describe('the shielded capability', () => {
  beforeEach(() => {
    HathorWallet.instances = [];
    HathorWallet.capability = CAPABILITY;
    registerShieldedCryptoProvider.mockReset();
    registerShieldedCryptoProvider.mockImplementation(function* register(wallet) {
      yield call([wallet, wallet.setShieldedCryptoProvider], PROVIDER);
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
    HathorWallet.onStart = () => new Promise(() => {});
  });

  test('setupWalletListeners forwards what the wallet emits until it is cancelled', async () => {
    const wallet = new HathorWallet({});
    const dispatched = [];
    const task = runSaga(
      { dispatch: (action) => dispatched.push(action) },
      setupWalletListeners,
      wallet,
    );

    wallet.emit('shielded-capability', CAPABILITY);
    await new Promise((resolve) => { setImmediate(resolve); });

    expect(dispatched).toEqual([shieldedCapabilityUpdate(CAPABILITY)]);
    expect(dispatched[0]).toEqual({ type: types.SHIELDED_CAPABILITY_UPDATE, payload: CAPABILITY });
    task.cancel();
    expect(wallet.listenerCount('shielded-capability')).toBe(0);
  });

  test('startWallet listens before start() and reads the capability once the wallet is ready', async () => {
    HathorWallet.onStart = async (wallet) => {
      HathorWallet.log.push(`listening:${wallet.listenerCount('shielded-capability')}`);
      return { network: 'testnet-shielded-outputs' };
    };

    const { log, dispatched } = await runStartWallet(
      { networkSettings: PRE_SETTINGS_SHIELDED_TESTNET },
      `dispatch:${types.TOKEN_FETCH_BALANCE_REQUESTED}`,
    );

    expect(log).toContain('listening:1');
    expect(dispatched).toContainEqual(shieldedCapabilityUpdate(CAPABILITY));
    const order = [
      'start',
      `dispatch:${types.SET_FULLNODE_NETWORK_NAME}`,
      'getShieldedCapability',
      `dispatch:${types.SHIELDED_CAPABILITY_UPDATE}`,
      `dispatch:${types.TOKEN_FETCH_BALANCE_REQUESTED}`,
    ].map((entry) => log.indexOf(entry));
    expect(order.every((index) => index >= 0)).toBe(true);
    expect([...order].sort((a, b) => a - b)).toEqual(order);
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

/**
 * A running fullnode-facade wallet whose stop() records its options, and resolves when the test
 * calls finishStop().
 */
function runningWallet() {
  const wallet = new HathorWallet({});
  wallet.walletStopped = false;
  wallet.stopCalls = [];
  wallet.stop = jest.fn((options) => {
    wallet.stopCalls.push(options);
    return new Promise((resolve) => { wallet.finishStop = resolve; });
  });
  return wallet;
}

// A wallet-service-facade wallet: it is not a HathorWallet.
function walletServiceWallet() {
  const { EventEmitter } = jest.requireActual('events');
  const wallet = new EventEmitter();
  wallet.conn = new EventEmitter();
  wallet.stop = jest.fn(async () => {});
  return wallet;
}

const flush = () => new Promise((resolve) => { setImmediate(resolve); });

describe('waitForWalletRestart', () => {
  const startAction = startWalletRequested({ words: 'seed words', pin: '111111' });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  // Runs trackRestartPin, as the wallet saga does, and dispatches `start` to it. Then runs the saga
  // for the wallet `start` started, with `wallet` as the running wallet, and dispatches `actions`
  // in order.
  function begin(actions, { wallet = null, start = startAction } = {}) {
    const channel = stdChannel();
    const dispatched = [];
    const io = {
      channel,
      dispatch: (action) => dispatched.push(action),
      getState: () => ({ wallet }),
    };
    const pinTracker = runSaga(io, trackRestartPin);
    channel.put(start);
    const task = runSaga(io, waitForWalletRestart, start);
    actions.forEach((action) => channel.put(action));
    return { task, dispatched, pinTracker };
  }

  async function run(actions, options) {
    const { task, dispatched, pinTracker } = begin(actions, options);
    await task.toPromise();
    pinTracker.cancel();
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

  test('starts a passkey wallet again with its start action, which has no PIN', async () => {
    const passkeyStartAction = startWalletRequested();
    expect(await run([reloadWalletRequested()], { start: passkeyStartAction }))
      .toEqual([passkeyStartAction]);
  });

  test('ends without starting the wallet on a new start request or a wallet reset', async () => {
    const wallet = runningWallet();
    expect(await run([
      walletPinChanged('222222'),
      startWalletRequested({ words: 'other words', pin: '333333' }),
    ], { wallet })).toEqual([]);
    expect(await run([resetWallet()], { wallet })).toEqual([]);
    expect(wallet.stop).not.toHaveBeenCalled();
  });

  test('stops the running wallet, keeping its storage, before it starts the wallet again', async () => {
    const wallet = runningWallet();

    const { task, dispatched, pinTracker } = begin([reloadWalletRequested()], { wallet });
    await flush();
    expect(wallet.stopCalls).toEqual([{ cleanStorage: false }]);
    expect(dispatched).toEqual([]);
    wallet.finishStop();
    await task.toPromise();
    pinTracker.cancel();

    expect(dispatched).toEqual([startAction]);
  });

  test('does not stop a wallet that is already stopped, as after a network change', async () => {
    const wallet = runningWallet();
    wallet.walletStopped = true;

    expect(await run([reloadWalletRequested()], { wallet })).toEqual([startAction]);
    expect(wallet.stop).not.toHaveBeenCalled();
  });

  test('does not stop a wallet-service wallet', async () => {
    const wallet = walletServiceWallet();

    expect(await run([reloadWalletRequested()], { wallet })).toEqual([startAction]);
    expect(wallet.stop).not.toHaveBeenCalled();
  });

  test('logs a stop that fails and starts the wallet again', async () => {
    const consoleError = jest.spyOn(console, 'error').mockImplementation(() => {});
    const wallet = runningWallet();
    wallet.stop.mockRejectedValue(new Error('stop failed'));

    expect(await run([reloadWalletRequested()], { wallet })).toEqual([startAction]);
    expect(consoleError).toHaveBeenCalledWith(
      expect.stringContaining('[wallet]'),
      expect.objectContaining({ message: 'stop failed' }),
    );
  });
});

describe('onStartWalletFailed', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  function run(wallet) {
    const dispatched = [];
    const task = runSaga(
      { dispatch: (action) => dispatched.push(action), getState: () => ({ wallet }) },
      onStartWalletFailed,
    );
    return { task, dispatched };
  }

  test('stops the failed wallet, keeping its storage, then drops it', async () => {
    const wallet = runningWallet();

    const { task, dispatched } = run(wallet);
    await flush();
    expect(wallet.stopCalls).toEqual([{ cleanStorage: false }]);
    expect(dispatched).toEqual([]);
    wallet.finishStop();
    await task.toPromise();

    expect(dispatched).toEqual([setWallet(null)]);
  });

  test('logs a stop that fails, and drops the wallet', async () => {
    const consoleError = jest.spyOn(console, 'error').mockImplementation(() => {});
    const wallet = runningWallet();
    wallet.stop.mockImplementation(() => { throw new Error('stop failed'); });

    const { task, dispatched } = run(wallet);
    await task.toPromise();

    expect(dispatched).toEqual([setWallet(null)]);
    expect(consoleError).toHaveBeenCalledWith(
      expect.stringContaining('[wallet]'),
      expect.objectContaining({ message: 'stop failed' }),
    );
  });

  test.each([
    ['a wallet that is already stopped', () => Object.assign(runningWallet(), {
      walletStopped: true,
    })],
    ['a wallet-service wallet', walletServiceWallet],
  ])('drops %s without a stop', async (_label, makeWallet) => {
    const wallet = makeWallet();

    const { task, dispatched } = run(wallet);
    await task.toPromise();

    expect(dispatched).toEqual([setWallet(null)]);
    expect(wallet.stop).not.toHaveBeenCalled();
  });
});

describe('trackRestartPin', () => {
  // waitForWalletRestart reads the PIN that trackRestartPin keeps: a reload starts the wallet with
  // it.
  test('drops the passkey scan key when the wallet is reset', async () => {
    clearPasskeyScanKey.mockClear();
    const channel = stdChannel();
    const pinTracker = runSaga({ channel, dispatch: () => {} }, trackRestartPin);

    channel.put(startWalletRequested());
    channel.put(reloadWalletRequested());
    expect(clearPasskeyScanKey).not.toHaveBeenCalled();
    channel.put(resetWallet());
    pinTracker.cancel();

    expect(clearPasskeyScanKey).toHaveBeenCalledTimes(1);
  });

  test('forgets the PIN when the wallet is reset', async () => {
    const startAction = startWalletRequested({ words: 'seed words', pin: '111111' });
    const channel = stdChannel();
    const dispatched = [];
    // No wallet is running, so the reload has none to stop.
    const io = {
      channel,
      dispatch: (action) => dispatched.push(action),
      getState: () => ({ wallet: null }),
    };
    const pinTracker = runSaga(io, trackRestartPin);
    channel.put(startAction);
    channel.put(resetWallet());
    const task = runSaga(io, waitForWalletRestart, startAction);
    channel.put(reloadWalletRequested());
    await task.toPromise();
    pinTracker.cancel();

    expect(dispatched).toEqual([startWalletRequested({ words: 'seed words', pin: null })]);
  });
});

describe('wallet saga', () => {
  // startWallet loads the wallet, then runs waitForWalletRestart. In its place, the saga runs this
  // start, which loads until the test dispatches WALLET_LOADED.
  const WALLET_LOADED = 'TEST_WALLET_LOADED';
  function* loadWallet(action) {
    yield take(WALLET_LOADED);
    yield call(waitForWalletRestart, action);
  }
  const replaceStartWallet = (next) => (effect) => (
    effect?.type === 'CALL' && effect.payload.fn === startWallet
      ? next(call(loadWallet, ...effect.payload.args))
      : next(effect)
  );

  // A PIN change can land before the wallet has loaded: the biometry migration of a lock screen
  // shown during the load, or a PIN change committed just before a reload began.
  test('reloads the wallet with the PIN of a PIN change that landed while it loaded', () => {
    const channel = stdChannel();
    const dispatched = [];
    const task = runSaga({
      channel,
      dispatch: (action) => dispatched.push(action),
      // The stand-in start leaves no wallet in the state, so the reload has none to stop.
      getState: () => ({ wallet: null }),
      effectMiddlewares: [replaceStartWallet],
    }, saga);
    [
      startWalletRequested({ words: 'seed words', pin: '111111' }),
      walletPinChanged('222222'),
      { type: WALLET_LOADED },
      reloadWalletRequested(),
    ].forEach((action) => channel.put(action));
    task.cancel();

    expect(dispatched).toEqual([
      startWalletRequested({ words: 'seed words', pin: '222222' }),
    ]);
  });
});
