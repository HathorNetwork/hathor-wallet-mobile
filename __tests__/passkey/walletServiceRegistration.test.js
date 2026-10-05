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
import { WALLET_SERVICE_FEATURE_TOGGLE } from '../../src/constants';
import {
  facadeSupportsExternalSigner,
  isWalletServiceRegistered,
  markWalletServiceRegistered,
  registerOnWalletService,
  shouldRegisterOnWalletService,
} from '../../src/passkey/walletServiceRegistration';
/* eslint-enable import/first */

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

  test('a failed wallet/init records nothing and propagates', async () => {
    const tempWallet = { start: jest.fn(async () => { throw new Error('ws down'); }), stop: jest.fn() };
    HathorWalletServiceWallet.mockImplementation(() => tempWallet);

    await expect(registerOnWalletService(WORDS, NETWORK_SETTINGS)).rejects.toThrow('ws down');
    expect(STORE.updateWalletMeta).not.toHaveBeenCalled();
  });
});
