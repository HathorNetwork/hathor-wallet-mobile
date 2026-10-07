import {
  jest, describe, test, expect, beforeEach, afterEach,
} from '@jest/globals';

jest.mock('@hathor/wallet-lib', () => ({
  ...jest.requireActual('@hathor/wallet-lib'),
  HathorWalletServiceWallet: jest.fn(),
}));

jest.mock('../../src/store', () => ({
  STORE: {
    getWalletMeta: jest.fn(),
    updateWalletMeta: jest.fn(() => Promise.resolve()),
  },
}));

jest.mock('../../src/logger', () => {
  const log = {
    error: jest.fn(), warn: jest.fn(), info: jest.fn(), debug: jest.fn(), log: jest.fn(),
  };
  return { logger: () => log };
});

/* eslint-disable import/first */
import { HathorWalletServiceWallet, config } from '@hathor/wallet-lib';
import { STORE } from '../../src/store';
import { logger } from '../../src/logger';
import { WALLET_SERVICE_FEATURE_TOGGLE } from '../../src/constants';
import {
  completeWalletServiceRegistration,
  facadeSupportsExternalSigner,
  finishWalletServiceRegistration,
  isWalletServiceRegistered,
  markWalletServiceRegistered,
  prepareWalletServiceRegistration,
  registerOnWalletService,
  shouldRegisterOnWalletService,
  walletServiceRegistrationForUnlock,
} from '../../src/passkey/walletServiceRegistration';
/* eslint-enable import/first */

const log = logger();

// Lets pending promise callbacks run.
const flush = () => new Promise((resolve) => { setImmediate(resolve); });

// A temp wallet-service wallet; `order` records the calls that matter, in sequence.
const makeTempWallet = (order = []) => ({
  start: jest.fn(async () => { order.push('start'); }),
  stop: jest.fn(async () => { order.push('stop'); }),
  clearSensitiveData: jest.fn(),
});

const WORDS = new Array(24).fill('abandon').join(' ');
const URL = 'https://ws.example/';
const NETWORK_SETTINGS = { network: 'mainnet', walletServiceUrl: URL, walletServiceWsUrl: 'wss://ws.example/' };
const FACADE_METHODS = ['setExternalTxSigningMethod', 'refreshFullAuthToken', 'startReadOnly'];

const setFacadeSupport = (supported) => {
  FACADE_METHODS.forEach((m) => {
    if (supported) {
      HathorWalletServiceWallet.prototype[m] = jest.fn();
    } else {
      delete HathorWalletServiceWallet.prototype[m];
    }
  });
};

beforeEach(() => {
  jest.clearAllMocks();
  STORE.getWalletMeta.mockReturnValue({ walletType: 'passkey', xpub: 'xpub' });
});

afterEach(() => {
  setFacadeSupport(false);
});

describe('facadeSupportsExternalSigner', () => {
  test('is false when the bundled wallet-lib lacks facade signing (e.g. 3.1.1)', () => {
    expect(facadeSupportsExternalSigner()).toBe(false);
  });

  test('is true once the facade exposes the signer, token and xpub-start methods', () => {
    setFacadeSupport(true);
    expect(facadeSupportsExternalSigner()).toBe(true);
  });
});

describe('registration flag', () => {
  test('is per wallet-service URL', () => {
    STORE.getWalletMeta.mockReturnValue({ walletServiceRegistrations: [URL] });

    expect(isWalletServiceRegistered(URL)).toBe(true);
    expect(isWalletServiceRegistered('https://other.example/')).toBe(false);
    expect(isWalletServiceRegistered('')).toBe(false);
  });

  test('marking adds the URL once, and un-marking removes it', async () => {
    STORE.getWalletMeta.mockReturnValue({ walletServiceRegistrations: [URL] });

    await markWalletServiceRegistered(URL);
    expect(STORE.updateWalletMeta).toHaveBeenLastCalledWith({ walletServiceRegistrations: [URL] });

    await markWalletServiceRegistered(URL, false);
    expect(STORE.updateWalletMeta).toHaveBeenLastCalledWith({ walletServiceRegistrations: [] });
  });

  test('a failed write is logged, never thrown', async () => {
    STORE.updateWalletMeta.mockReturnValueOnce(Promise.reject(new Error('disk full')));

    await expect(markWalletServiceRegistered(URL)).resolves.toBeUndefined();
  });
});

describe('shouldRegisterOnWalletService', () => {
  const flagOn = { [WALLET_SERVICE_FEATURE_TOGGLE]: true };

  test('only when the flag is on, a URL is set, the lib supports it and it is not registered', () => {
    setFacadeSupport(true);
    expect(shouldRegisterOnWalletService(flagOn, NETWORK_SETTINGS)).toBe(true);

    expect(shouldRegisterOnWalletService({}, NETWORK_SETTINGS)).toBe(false);
    expect(shouldRegisterOnWalletService(flagOn, { ...NETWORK_SETTINGS, walletServiceUrl: '' }))
      .toBe(false);
    STORE.getWalletMeta.mockReturnValue({ walletServiceRegistrations: [URL] });
    expect(shouldRegisterOnWalletService(flagOn, NETWORK_SETTINGS)).toBe(false);
  });

  test('never on a wallet-lib without facade signing', () => {
    expect(shouldRegisterOnWalletService(flagOn, NETWORK_SETTINGS)).toBe(false);
  });
});

describe('registerOnWalletService', () => {
  test('creates the wallet with a temp wallet from the words, records it, and stops the temp wallet', async () => {
    const tempWallet = { start: jest.fn(async () => {}), stop: jest.fn(async () => {}) };
    HathorWalletServiceWallet.mockImplementation(() => tempWallet);
    jest.spyOn(config, 'setWalletServiceBaseUrl');

    await registerOnWalletService(WORDS, NETWORK_SETTINGS);

    expect(config.setWalletServiceBaseUrl).toHaveBeenCalledWith(URL);
    expect(HathorWalletServiceWallet).toHaveBeenCalledWith(
      expect.objectContaining({ seed: WORDS, enableWs: false }),
    );
    const [{ pinCode, password }] = tempWallet.start.mock.calls[0];
    expect(pinCode).toMatch(/^[0-9a-f]{64}$/);
    expect(password).toBe(pinCode);
    expect(STORE.updateWalletMeta).toHaveBeenCalledWith({ walletServiceRegistrations: [URL] });
    expect(tempWallet.stop).toHaveBeenCalledWith({ cleanStorage: true });
  });

  test('a failed wallet/init records nothing, drops the seed and propagates', async () => {
    const tempWallet = makeTempWallet();
    tempWallet.start.mockRejectedValue(new Error('ws down'));
    HathorWalletServiceWallet.mockImplementation(() => tempWallet);

    await expect(registerOnWalletService(WORDS, NETWORK_SETTINGS)).rejects.toThrow('ws down');
    expect(STORE.updateWalletMeta).not.toHaveBeenCalled();
    expect(tempWallet.clearSensitiveData).toHaveBeenCalledTimes(1);
  });
});

describe('prepareWalletServiceRegistration', () => {
  test('builds the temp wallet on the configured network and wallet-service, without starting it', () => {
    const tempWallet = makeTempWallet();
    HathorWalletServiceWallet.mockImplementation(() => tempWallet);
    const setUrl = jest.spyOn(config, 'setWalletServiceBaseUrl');
    const setWsUrl = jest.spyOn(config, 'setWalletServiceBaseWsUrl');

    const registration = prepareWalletServiceRegistration(WORDS, NETWORK_SETTINGS);

    expect(registration).toEqual({ tempWallet, walletServiceUrl: URL });
    const [options] = HathorWalletServiceWallet.mock.calls[0];
    expect(options).toMatchObject({ seed: WORDS, enableWs: false });
    expect(options.network.name).toBe(NETWORK_SETTINGS.network);
    expect(setUrl).toHaveBeenCalledWith(URL);
    expect(setWsUrl).toHaveBeenCalledWith(NETWORK_SETTINGS.walletServiceWsUrl);
    // Starting talks to the wallet-service; it happens later, outside the passkey ceremony.
    expect(tempWallet.start).not.toHaveBeenCalled();
  });
});

describe('completeWalletServiceRegistration', () => {
  test('starts the temp wallet with a one-time pin, records the registration, then stops it', async () => {
    const order = [];
    const tempWallet = makeTempWallet(order);
    STORE.updateWalletMeta.mockImplementation(async () => { order.push('record'); });

    await completeWalletServiceRegistration({ tempWallet, walletServiceUrl: URL });

    expect(order).toEqual(['start', 'record', 'stop']);
    const [{ pinCode, password }] = tempWallet.start.mock.calls[0];
    expect(pinCode).toMatch(/^[0-9a-f]{64}$/);
    expect(password).toBe(pinCode);
    expect(STORE.updateWalletMeta).toHaveBeenCalledWith({ walletServiceRegistrations: [URL] });
    expect(tempWallet.stop).toHaveBeenCalledWith({ cleanStorage: true });
  });
});

describe('registration at unlock', () => {
  const flagOn = { [WALLET_SERVICE_FEATURE_TOGGLE]: true };

  test('has no hook when the wallet should not register', () => {
    expect(walletServiceRegistrationForUnlock(flagOn, NETWORK_SETTINGS)).toBeUndefined();
  });

  test('the hook only prepares the registration inside the ceremony', () => {
    setFacadeSupport(true);
    const tempWallet = makeTempWallet();
    HathorWalletServiceWallet.mockImplementation(() => tempWallet);

    const onWords = walletServiceRegistrationForUnlock(flagOn, NETWORK_SETTINGS);
    const registration = onWords(WORDS);

    expect(registration).toEqual({ tempWallet, walletServiceUrl: URL });
    expect(tempWallet.start).not.toHaveBeenCalled();
  });

  test('a failure to prepare is logged and never blocks the unlock', () => {
    setFacadeSupport(true);
    const failure = new Error('bad network settings');
    HathorWalletServiceWallet.mockImplementation(() => { throw failure; });

    const onWords = walletServiceRegistrationForUnlock(flagOn, NETWORK_SETTINGS);

    expect(onWords(WORDS)).toBeNull();
    expect(log.error).toHaveBeenCalledWith(expect.any(String), failure);
  });

  test('finishing runs in the background: it returns at once and completes later', async () => {
    const order = [];
    const tempWallet = makeTempWallet(order);

    expect(finishWalletServiceRegistration({ tempWallet, walletServiceUrl: URL })).toBeUndefined();
    await flush();

    expect(order).toEqual(['start', 'stop']);
    expect(STORE.updateWalletMeta).toHaveBeenCalledWith({ walletServiceRegistrations: [URL] });
  });

  test('a failed background registration is logged, never thrown', async () => {
    const tempWallet = makeTempWallet();
    const failure = new Error('ws down');
    tempWallet.start.mockRejectedValue(failure);

    finishWalletServiceRegistration({ tempWallet, walletServiceUrl: URL });
    await flush();

    expect(log.error).toHaveBeenCalledWith(expect.any(String), failure);
    expect(STORE.updateWalletMeta).not.toHaveBeenCalled();
  });

  test('finishing nothing is a no-op', () => {
    expect(() => finishWalletServiceRegistration(null)).not.toThrow();
    expect(() => finishWalletServiceRegistration(undefined)).not.toThrow();
  });
});
