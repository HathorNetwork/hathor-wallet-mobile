import { jest, describe, test, expect, beforeEach } from '@jest/globals';

// The global automock of this package still loads the real module, which needs the native
// Firebase app; these sagas only need the named exports to exist.
jest.mock('@react-native-firebase/messaging', () => ({
  AuthorizationStatus: {
    AUTHORIZED: 1, DENIED: 0, NOT_DETERMINED: -1, PROVISIONAL: 2, EPHEMERAL: 3,
  },
  deleteToken: jest.fn(),
  getMessaging: jest.fn(),
  getToken: jest.fn(),
  hasPermission: jest.fn(),
  onMessage: jest.fn(),
  registerDeviceForRemoteMessages: jest.fn(),
  requestPermission: jest.fn(),
}));

jest.mock('@hathor/wallet-lib', () => ({
  ...jest.requireActual('@hathor/wallet-lib'),
  HathorWalletServiceWallet: jest.fn(),
}));

jest.mock('../../src/store', () => ({
  STORE: {
    isPasskeyWallet: jest.fn(),
    getWalletWords: jest.fn(),
    getWalletMeta: jest.fn(),
    getStorage: jest.fn(),
    getItem: jest.fn(() => null),
    setItem: jest.fn(),
  },
}));

// One shared logger object, so the test can assert on what the saga logs.
jest.mock('../../src/logger', () => {
  const log = {
    error: jest.fn(), warn: jest.fn(), info: jest.fn(), debug: jest.fn(), log: jest.fn(),
  };
  return { logger: () => log };
});

/* eslint-disable import/first */
import { HathorWalletServiceWallet, PushNotification as pushLib } from '@hathor/wallet-lib';
import { STORE } from '../../src/store';
import { logger } from '../../src/logger';
import {
  loadWallet,
  registration,
  startTempWalletServiceWallet,
} from '../../src/sagas/pushNotification';
import { startWallet } from '../../src/sagas/wallet';
import { showPinScreenForResult } from '../../src/sagas/helpers';
import {
  PasskeyCancelledError,
  PasskeyXpubMismatchError,
  withPasskeyWords,
} from '../../src/passkey/passkeySigner';
import {
  pushApiReady,
  pushLoadWalletFailed,
  pushLoadWalletSuccess,
  pushRegisterFailed,
  setAvailablePushNotification,
  setUseWalletService,
  startWalletRequested,
  types,
} from '../../src/actions';
/* eslint-enable import/first */

const log = logger();
const WORDS = new Array(24).fill('abandon').join(' ');
const NETWORK_SETTINGS = {
  network: 'mainnet',
  walletServiceUrl: 'https://ws.example/',
  walletServiceWsUrl: 'wss://ws.example/',
};

const isCall = (effect, fn) => effect?.type === 'CALL' && effect.payload.fn === fn;
const isPut = (effect, action) => effect?.type === 'PUT'
  && JSON.stringify(effect.payload.action) === JSON.stringify(action);

beforeEach(() => {
  jest.clearAllMocks();
});

describe('loadWallet (passkey wallet)', () => {
  beforeEach(() => {
    STORE.isPasskeyWallet.mockReturnValue(true);
  });

  // Steps the passkey branch up to the ceremony and returns the generator + the effects so far.
  const runToCeremony = () => {
    const gen = loadWallet();
    const effects = [];
    let step = gen.next();
    effects.push(step.value);
    step = gen.next(NETWORK_SETTINGS); // select(getNetworkSettings)
    effects.push(step.value);
    return { gen, effects, ceremony: step.value };
  };

  test('runs ONE passkey ceremony and starts a temp wallet-service wallet with the words', async () => {
    const { gen, effects, ceremony } = runToCeremony();
    expect(isCall(ceremony, withPasskeyWords)).toBe(true);

    // Run the callback the saga hands to the ceremony, as withPasskeyWords would.
    const tempWallet = { start: jest.fn(async () => {}) };
    HathorWalletServiceWallet.mockImplementation(() => tempWallet);
    const startFn = ceremony.payload.args[0];
    await expect(startFn(WORDS)).resolves.toBe(tempWallet);

    expect(HathorWalletServiceWallet).toHaveBeenCalledWith(
      expect.objectContaining({ seed: WORDS, enableWs: false }),
    );
    // start() gets a random, non-empty one-time pin (nothing is persisted).
    const [{ pinCode, password }] = tempWallet.start.mock.calls[0];
    expect(pinCode).toMatch(/^[0-9a-f]{64}$/);
    expect(password).toBe(pinCode);

    const done = gen.next(tempWallet);
    expect(isPut(done.value, pushLoadWalletSuccess({ walletService: tempWallet }))).toBe(true);
    expect(gen.next().done).toBe(true);
    // The PIN screen is never involved for a passkey wallet.
    expect(effects.some((e) => isCall(e, showPinScreenForResult))).toBe(false);
  });

  test('a cancelled ceremony reports { cancelled: true } and logs nothing', () => {
    const { gen } = runToCeremony();
    const error = new PasskeyCancelledError();

    const step = gen.throw(error);

    expect(step.value.type).toBe('PUT');
    expect(step.value.payload.action).toEqual(pushLoadWalletFailed({ error, cancelled: true }));
    expect(log.error).not.toHaveBeenCalled();
  });

  test('a wrong passkey reports { cancelled: false } and logs the failure', () => {
    const { gen } = runToCeremony();
    const error = new PasskeyXpubMismatchError('Savings');

    const step = gen.throw(error);

    expect(step.value.payload.action).toEqual(pushLoadWalletFailed({ error, cancelled: false }));
    expect(log.error).toHaveBeenCalled();
  });
});

describe('loadWallet (seed wallet, unchanged)', () => {
  test('asks for the PIN, decrypts the words and starts the temp wallet with that PIN', () => {
    STORE.isPasskeyWallet.mockReturnValue(false);
    const gen = loadWallet();

    expect(gen.next().value.type).toBe('PUT'); // dispatch workaround
    expect(gen.next().value.type).toBe('SELECT'); // useWalletService
    expect(gen.next(false).value.type).toBe('SELECT'); // network settings
    const pinStep = gen.next(NETWORK_SETTINGS).value;
    expect(isCall(pinStep, showPinScreenForResult)).toBe(true);
    gen.next('123456'); // delay(300)
    gen.next(); // STORE.getWalletWords(pin)
    const startStep = gen.next(WORDS).value;

    expect(STORE.getWalletWords).toHaveBeenCalledWith('123456');
    expect(isCall(startStep, startTempWalletServiceWallet)).toBe(true);
    expect(startStep.payload.args[0]).toBe(WORDS);
    expect(startStep.payload.args[2]).toBe('123456');
  });
});

describe('registration', () => {
  const action = { payload: { enabled: true, showAmountEnabled: false, deviceId: 'device-1' } };

  // Steps registration up to the race on the wallet load and resolves it with `raceResult`.
  const runToRace = (raceResult) => {
    const gen = registration(action);
    gen.next(); // call(hasPostNotificationAuthorization)
    gen.next(true); // select(!deviceRegistered)
    gen.next(false); // put(pushLoadWalletRequested())
    gen.next(); // race(...)
    return { gen, step: gen.next(raceResult) };
  };
  const loaded = (walletService) => [
    { type: types.PUSH_WALLET_LOAD_SUCCESS, payload: { walletService } },
    undefined,
  ];

  test('a cancelled wallet load returns to idle without the error state', () => {
    const { step } = runToRace([undefined, pushLoadWalletFailed({ cancelled: true })]);

    expect(isPut(step.value, pushApiReady())).toBe(true);
  });

  test('a failed (not cancelled) wallet load still reports the registration failure', () => {
    const { step } = runToRace([undefined, pushLoadWalletFailed({ cancelled: false })]);

    expect(isPut(step.value, pushRegisterFailed())).toBe(true);
  });

  test('stops the temporary wallet after a successful registration', () => {
    const tempWallet = { stop: jest.fn() };
    const { gen, step } = runToRace(loaded(tempWallet));
    expect(step.value.type).toBe('SELECT'); // state.wallet

    const registerStep = gen.next({ app: 'wallet' }).value; // a different (fullnode) wallet
    expect(isCall(registerStep, pushLib.PushNotification.registerDevice)).toBe(true);
    gen.next({ success: true }); // put(pushRegisterSuccess)
    const stopStep = gen.next().value;

    expect(stopStep.type).toBe('CALL');
    expect(stopStep.payload.fn).toBe(tempWallet.stop);
    expect(stopStep.payload.context).toBe(tempWallet);
    expect(stopStep.payload.args).toEqual([{ cleanStorage: true }]);
  });

  test('still stops the temporary wallet when registerDevice throws', () => {
    const tempWallet = { stop: jest.fn() };
    const { gen } = runToRace(loaded(tempWallet));
    gen.next({ app: 'wallet' }); // registerDevice call

    expect(isPut(gen.throw(new Error('api down')).value, pushRegisterFailed())).toBe(true);
    expect(gen.next().value.payload.fn).toBe(tempWallet.stop);
  });

  test('never stops the app wallet on the wallet-service facade', () => {
    const appWallet = { stop: jest.fn() };
    const { gen } = runToRace(loaded(appWallet));
    gen.next(appWallet); // state.wallet IS the loaded wallet
    gen.next({ success: true }); // put(pushRegisterSuccess)

    expect(gen.next().done).toBe(true);
  });
});

describe('startWallet (passkey wallet)', () => {
  test('applies the push flag instead of forcing push off, and keeps the fullnode facade', () => {
    STORE.getWalletMeta.mockReturnValue({ walletType: 'passkey', xpub: 'xpub-passkey' });
    STORE.getStorage.mockReturnValue({
      store: { cleanMetadata: jest.fn() },
      cleanStorage: jest.fn(),
    });
    const gen = startWallet(startWalletRequested());

    // Step through the setup until the saga asks whether push is enabled.
    let step = gen.next();
    for (let i = 0; i < 30 && !(step.value?.type === 'CALL'
      && step.value.payload.fn.name === 'isPushNotificationEnabled'); i += 1) {
      step = gen.next(step.value?.type === 'SELECT' ? NETWORK_SETTINGS : undefined);
    }
    expect(step.value.payload.fn.name).toBe('isPushNotificationEnabled');

    const puts = [gen.next(true).value, gen.next().value];
    expect(isPut(puts[0], setUseWalletService(false))).toBe(true);
    expect(isPut(puts[1], setAvailablePushNotification(true))).toBe(true);
  });
});
