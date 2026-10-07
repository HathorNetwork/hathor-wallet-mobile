import {
  jest, describe, test, expect, beforeEach, afterEach,
} from '@jest/globals';

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
import { init, loadWallet, registration } from '../../src/sagas/pushNotification';
import {
  markWalletServiceRegistered,
  startTempWalletServiceWallet,
} from '../../src/passkey/walletServiceRegistration';
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
  pushAskRegistrationRefreshQuestion,
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

    // Starting the temp wallet created the wallet on the wallet-service: the saga records that, so
    // the app can start this wallet on the wallet-service facade from now on.
    const markStep = gen.next().value; // after start()
    expect(isCall(markStep, markWalletServiceRegistered)).toBe(true);
    expect(markStep.payload.args).toEqual([NETWORK_SETTINGS.walletServiceUrl]);

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

  // A wallet-service timeout or outage isn't a bug: like for seed wallets, the user gets the
  // generic "try again later" failure (registration's fallback), and nothing is reported.
  test('a failed start drops the seed and fails without a report', () => {
    const { gen } = runToCeremony();
    const tempWallet = makeTempWallet();
    gen.next(tempWallet); // call(start)
    const error = new Error('timeout of 10000ms exceeded');

    const failStep = gen.throw(error);

    expect(tempWallet.clearSensitiveData).toHaveBeenCalledTimes(1);
    expect(failStep.value.payload.action).toEqual(
      pushLoadWalletFailed({ error, cancelled: false, reported: false }),
    );
    expect(gen.next().done).toBe(true);
    expect(log.error).toHaveBeenCalledWith(expect.any(String), error);
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
  const XPUB = 'xpub-passkey';
  const facadeMethods = ['setExternalTxSigningMethod', 'refreshFullAuthToken', 'startReadOnly'];
  const callName = (effect) => (effect?.type === 'CALL' ? effect.payload.fn?.name : undefined);

  // Simulate a wallet-lib whose wallet-service facade supports an external signer (3.1.1 doesn't).
  const setFacadeSupport = (supported) => {
    facadeMethods.forEach((m) => {
      if (supported) {
        HathorWalletServiceWallet.prototype[m] = jest.fn();
      } else {
        delete HathorWalletServiceWallet.prototype[m];
      }
    });
  };

  beforeEach(() => {
    STORE.getStorage.mockReturnValue({
      store: { cleanMetadata: jest.fn() },
      cleanStorage: jest.fn(),
    });
  });

  afterEach(() => {
    setFacadeSupport(false);
  });

  // Steps startWallet, answering the wallet-service flag with `wsEnabled`, until `until` matches.
  const runStartWallet = ({ registrations, wsEnabled, until }) => {
    STORE.getWalletMeta.mockReturnValue({
      walletType: 'passkey', xpub: XPUB, walletServiceRegistrations: registrations,
    });
    const gen = startWallet(startWalletRequested());
    const effects = [];
    let step = gen.next();
    for (let i = 0; i < 60 && !step.done && !until(step.value); i += 1) {
      effects.push(step.value);
      let answer;
      if (step.value?.type === 'SELECT') answer = NETWORK_SETTINGS;
      if (callName(step.value) === 'isWalletServiceEnabled') answer = wsEnabled;
      if (callName(step.value) === 'isPushNotificationEnabled') answer = true;
      step = gen.next(answer);
    }
    return { gen, step, effects };
  };
  const isUseWalletServicePut = (e) => e?.type === 'PUT'
    && e.payload.action?.type === setUseWalletService(true).type;

  test('applies the push flag instead of forcing push off', () => {
    const { gen, effects, step } = runStartWallet({
      registrations: [], wsEnabled: false, until: isUseWalletServicePut,
    });

    expect(isPut(step.value, setUseWalletService(false))).toBe(true);
    expect(effects.some((e) => callName(e) === 'isPushNotificationEnabled')).toBe(true);
    expect(isPut(gen.next().value, setAvailablePushNotification(true))).toBe(true);
  });

  test.each([
    ['the wallet-service flag is off', { wsEnabled: false, registered: true, supported: true }],
    ['the wallet is not registered there', { wsEnabled: true, registered: false, supported: true }],
    ['the bundled wallet-lib lacks facade signing', { wsEnabled: true, registered: true, supported: false }],
  ])('stays on the fullnode facade when %s', (_why, { wsEnabled, registered, supported }) => {
    setFacadeSupport(supported);
    const { step } = runStartWallet({
      registrations: registered ? [NETWORK_SETTINGS.walletServiceUrl] : [],
      wsEnabled,
      until: isUseWalletServicePut,
    });

    expect(isPut(step.value, setUseWalletService(false))).toBe(true);
  });

  test('runs on the wallet-service facade from the xpub, with the passkey signer, when registered', () => {
    setFacadeSupport(true);
    const facadeWallet = {
      setExternalTxSigningMethod: jest.fn(),
      startReadOnly: jest.fn(),
      refreshFullAuthToken: jest.fn(),
      isReady: jest.fn(() => true),
    };
    HathorWalletServiceWallet.mockImplementation(() => facadeWallet);

    const { step, effects } = runStartWallet({
      registrations: [NETWORK_SETTINGS.walletServiceUrl],
      wsEnabled: true,
      until: (e) => e?.type === 'CALL' && e.payload.fn === facadeWallet.startReadOnly,
    });

    expect(effects.some((e) => isPut(e, setUseWalletService(true)))).toBe(true);
    // Built from the xpub only — no seed, no PIN screen.
    const [params] = HathorWalletServiceWallet.mock.calls[0];
    expect(params).toEqual(expect.objectContaining({ xpub: XPUB }));
    expect(params.seed).toBeUndefined();
    expect(params.requestPassword.name).toBe('passkeyRequestPassword');
    // The passkey signer is registered, and the wallet is started read-only (it's registered).
    expect(facadeWallet.setExternalTxSigningMethod).toHaveBeenCalledWith(expect.any(Function));
    expect(step.value.payload.context).toBe(facadeWallet);
  });

  test('forgets the registration when the facade start fails, so the next unlock re-registers', () => {
    setFacadeSupport(true);
    const facadeWallet = {
      setExternalTxSigningMethod: jest.fn(), startReadOnly: jest.fn(), isReady: jest.fn(),
    };
    HathorWalletServiceWallet.mockImplementation(() => facadeWallet);
    const { gen } = runStartWallet({
      registrations: [NETWORK_SETTINGS.walletServiceUrl],
      wsEnabled: true,
      until: (e) => e?.type === 'CALL' && e.payload.fn === facadeWallet.startReadOnly,
    });

    let step = gen.throw(new Error('wallet not found'));
    const isUnmark = (e) => isCall(e, markWalletServiceRegistered);
    for (let i = 0; i < 10 && !step.done && !isUnmark(step.value); i += 1) {
      step = gen.next();
    }

    expect(isCall(step.value, markWalletServiceRegistered)).toBe(true);
    expect(step.value.payload.args).toEqual([NETWORK_SETTINGS.walletServiceUrl, false]);
  });
});

describe('init weekly registration refresh', () => {
  const runInit = ({ passkey }) => {
    STORE.isPasskeyWallet.mockReturnValue(passkey);
    const threeWeeksAgo = Date.now() - 21 * 24 * 60 * 60 * 1000;
    STORE.getItem.mockImplementation((key) => ({
      'pushNotification:settings': { enabled: true, showAmountEnabled: false },
      'pushNotification:enabledAt': threeWeeksAgo,
      'pushNotification:deviceId': 'device-1',
    }[key] ?? null));
    const gen = init();
    const decisions = [
      pushAskRegistrationRefreshQuestion().type,
      types.PUSH_REGISTRATION_REQUESTED,
    ];
    let step = gen.next();
    for (let i = 0; i < 60 && !step.done; i += 1) {
      if (step.value?.type === 'PUT' && decisions.includes(step.value.payload.action?.type)) {
        return step.value.payload.action.type;
      }
      // available, device registered, channel/category, listener, useWalletService
      let answer = true;
      if (callName(step.value) === 'getDeviceId') answer = 'device-1';
      if (step.value?.type === 'SELECT' && step.value.payload.selector.toString().includes('walletStartState')) {
        answer = 'READY';
      }
      step = gen.next(answer);
    }
    return null;
  };
  const callName = (effect) => (effect?.type === 'CALL' ? effect.payload.fn?.name : undefined);

  test('a passkey wallet on the wallet-service facade is asked first (no surprise Face ID)', () => {
    expect(runInit({ passkey: true })).toBe(pushAskRegistrationRefreshQuestion().type);
  });

  test('a seed wallet on the wallet-service facade still refreshes silently', () => {
    expect(runInit({ passkey: false })).toBe(types.PUSH_REGISTRATION_REQUESTED);
  });
});
