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
import {
  config,
  HathorWalletServiceWallet,
  PushNotification as pushLib,
} from '@hathor/wallet-lib';
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
  PasskeyMetadataMissingError,
  PasskeyXpubMismatchError,
  withPasskeyWords,
} from '../../src/passkey/passkeySigner';
import {
  onExceptionCaptured,
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

  // A temp wallet as the ceremony callback builds it (start is stubbed per test).
  const makeTempWallet = () => ({ start: jest.fn(), clearSensitiveData: jest.fn() });

  test('runs ONE passkey ceremony, then starts the temp wallet outside the passkey lock', () => {
    const setUrl = jest.spyOn(config, 'setWalletServiceBaseUrl');
    const setWsUrl = jest.spyOn(config, 'setWalletServiceBaseWsUrl');
    const { gen, effects, ceremony } = runToCeremony();
    expect(isCall(ceremony, withPasskeyWords)).toBe(true);
    // The temp wallet talks to the configured network's wallet-service.
    expect(setUrl).toHaveBeenCalledWith(NETWORK_SETTINGS.walletServiceUrl);
    expect(setWsUrl).toHaveBeenCalledWith(NETWORK_SETTINGS.walletServiceWsUrl);

    // Inside the ceremony the callback only BUILDS the wallet from the words, on the right
    // network; it doesn't start it.
    const tempWallet = makeTempWallet();
    HathorWalletServiceWallet.mockImplementation(() => tempWallet);
    expect(ceremony.payload.args[0](WORDS)).toBe(tempWallet);
    const [walletOptions] = HathorWalletServiceWallet.mock.calls[0];
    expect(walletOptions).toMatchObject({ seed: WORDS, enableWs: false });
    expect(walletOptions.network.name).toBe(NETWORK_SETTINGS.network);
    expect(tempWallet.start).not.toHaveBeenCalled();

    // start() is a separate effect, after withPasskeyWords returned (and released its lock), with
    // a random, non-empty one-time pin (nothing is persisted).
    const startStep = gen.next(tempWallet).value;
    expect(startStep.type).toBe('CALL');
    expect(startStep.payload.fn).toBe(tempWallet.start);
    expect(startStep.payload.context).toBe(tempWallet);
    const [{ pinCode, password }] = startStep.payload.args;
    expect(pinCode).toMatch(/^[0-9a-f]{64}$/);
    expect(password).toBe(pinCode);

    const done = gen.next();
    expect(isPut(done.value, pushLoadWalletSuccess({ walletService: tempWallet }))).toBe(true);
    expect(gen.next().done).toBe(true);
    // The PIN screen is never involved for a passkey wallet.
    expect(effects.some((e) => isCall(e, showPinScreenForResult))).toBe(false);
  });

  test('a cancelled ceremony reports { cancelled: true } and logs nothing', () => {
    const { gen } = runToCeremony();
    const error = new PasskeyCancelledError();

    const step = gen.throw(error);

    expect(step.value.payload.action).toEqual(
      pushLoadWalletFailed({ error, cancelled: true, reported: false }),
    );
    expect(log.error).not.toHaveBeenCalled();
  });

  test('an expected passkey error (wrong passkey) is passed on to be shown, not reported', () => {
    const { gen } = runToCeremony();
    const error = new PasskeyXpubMismatchError('Savings');

    const step = gen.throw(error);

    expect(step.value.payload.action).toEqual(
      pushLoadWalletFailed({ error, cancelled: false, reported: false }),
    );
    expect(log.error).not.toHaveBeenCalled();
  });

  test('an unexpected failure is logged and reported through the global error handler', () => {
    const { gen } = runToCeremony();
    const error = new PasskeyMetadataMissingError();

    const reportStep = gen.throw(error);

    expect(log.error).toHaveBeenCalledWith(expect.any(String), error);
    expect(isPut(reportStep.value, onExceptionCaptured(error, false))).toBe(true);
    expect(gen.next().value.payload.action).toEqual(
      pushLoadWalletFailed({ error, cancelled: false, reported: true }),
    );
  });

  test('a failed start drops the seed and is reported', () => {
    const { gen } = runToCeremony();
    const tempWallet = makeTempWallet();
    gen.next(tempWallet); // call(start)
    const error = new Error('wallet-service unavailable');

    const reportStep = gen.throw(error);

    expect(tempWallet.clearSensitiveData).toHaveBeenCalledTimes(1);
    expect(isPut(reportStep.value, onExceptionCaptured(error, false))).toBe(true);
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

  test('a reported wallet load failure returns to idle, without the push error on top', () => {
    const error = new Error('boom');
    const { step } = runToRace([
      undefined,
      pushLoadWalletFailed({ error, cancelled: false, reported: true }),
    ]);

    expect(isPut(step.value, pushApiReady())).toBe(true);
  });

  test('an expected passkey error shows its own message instead of "try again later"', () => {
    const error = new PasskeyXpubMismatchError('Savings');
    const { step } = runToRace([
      undefined,
      pushLoadWalletFailed({ error, cancelled: false, reported: false }),
    ]);

    expect(isPut(step.value, pushRegisterFailed(error.message))).toBe(true);
  });

  test('any other failed wallet load still reports the generic registration failure', () => {
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

  test('a failing stop is only logged and never fails the registration', () => {
    const tempWallet = { stop: jest.fn() };
    const { gen } = runToRace(loaded(tempWallet));
    gen.next({ app: 'wallet' }); // registerDevice call
    gen.next({ success: true }); // put(pushRegisterSuccess)
    gen.next(); // call(stop)
    const stopError = new Error('stop failed');

    const end = gen.throw(stopError);

    expect(log.error).toHaveBeenCalledWith(expect.any(String), stopError);
    expect(end.done).toBe(true);
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
