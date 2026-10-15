/**
 * Copyright (c) Hathor Labs and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { jest, describe, test, expect, beforeEach, afterEach } from '@jest/globals';

// The wallet metadata store: the tests set the loaded wallet's metadata.
jest.mock('../../src/store', () => ({
  STORE: {
    getWalletMeta: jest.fn(),
    updateWalletMeta: jest.fn(() => Promise.resolve()),
  },
}));

// The passkey ceremony boundary: the tests hand the ceremony's words to withPasskeyWords.
jest.mock('../../src/passkey/passkeyService', () => ({
  ...jest.requireActual('../../src/passkey/passkeyService'),
  signInWalletWordsFromPasskey: jest.fn(),
  isPasskeyCancel: jest.fn(() => false),
}));

/* eslint-disable import/first */
import { walletUtils } from '@hathor/wallet-lib';
import { STORE } from '../../src/store';
import { NETWORK_MAINNET } from '../../src/constants';
import { signInWalletWordsFromPasskey } from '../../src/passkey/passkeyService';
import { derivePasskeyXpub } from '../../src/passkey/passkeySigner';
import {
  clearPasskeyScanKey,
  derivePasskeyShieldedKeys,
  getPasskeyScanKey,
  getPasskeyShieldedXpubs,
  holdPasskeyScanKey,
  rememberPasskeyShieldedKeys,
  supportsPasskeyShielded,
  syncPasskeyShieldedAccessData,
  unlockPasskeyShieldedKeys,
} from '../../src/passkey/shieldedKeys';
/* eslint-enable import/first */

// A valid BIP39 phrase, so the root key is real.
const WORDS = `${'abandon '.repeat(23)}art`;
const XPUB = derivePasskeyXpub(WORDS);
const XPUBS = { scanXpubkey: 'xpub-scan', spendXpubkey: 'xpub-spend' };
const SCAN_KEY = 'xprv-scan';

// What the bundled wallet-lib has: the derivers come with the shielded xpub-only support.
const LIB_DERIVERS = {
  deriveShieldedXpubs: walletUtils.deriveShieldedXpubs,
  deriveShieldedScanXPrivKey: walletUtils.deriveShieldedScanXPrivKey,
};
const libDerives = typeof LIB_DERIVERS.deriveShieldedXpubs === 'function';

/** Sets the wallet-lib derivers, or removes them (undefined), until the test ends. */
function setDerivers({ deriveShieldedXpubs, deriveShieldedScanXPrivKey }) {
  walletUtils.deriveShieldedXpubs = deriveShieldedXpubs;
  walletUtils.deriveShieldedScanXPrivKey = deriveShieldedScanXPrivKey;
}

function restoreDerivers() {
  if (LIB_DERIVERS.deriveShieldedXpubs) {
    setDerivers(LIB_DERIVERS);
  } else {
    delete walletUtils.deriveShieldedXpubs;
    delete walletUtils.deriveShieldedScanXPrivKey;
  }
}

/** Stand-in derivers, so the tests run on a wallet-lib without them too. */
const stubDerivers = () => setDerivers({
  deriveShieldedXpubs: jest.fn(() => XPUBS),
  deriveShieldedScanXPrivKey: jest.fn(() => SCAN_KEY),
});

beforeEach(() => {
  clearPasskeyScanKey();
  STORE.getWalletMeta.mockReset();
  STORE.updateWalletMeta.mockReset();
  STORE.updateWalletMeta.mockImplementation(() => Promise.resolve());
});

afterEach(() => {
  restoreDerivers();
  jest.restoreAllMocks();
});

describe('on a wallet-lib without the shielded derivers', () => {
  beforeEach(() => {
    setDerivers({ deriveShieldedXpubs: undefined, deriveShieldedScanXPrivKey: undefined });
  });

  test('nothing is derived nor reported, so passkey shielded stays off', async () => {
    STORE.getWalletMeta.mockReturnValue({ xpub: XPUB, shieldedXpubs: XPUBS });
    const storage = { getAccessData: jest.fn(), saveAccessData: jest.fn() };

    expect(supportsPasskeyShielded()).toBe(false);
    expect(derivePasskeyShieldedKeys(WORDS)).toBeNull();
    expect(getPasskeyShieldedXpubs()).toBeNull();
    expect(rememberPasskeyShieldedKeys(WORDS)).toBeNull();
    expect(getPasskeyScanKey()).toBeNull();
    expect(STORE.updateWalletMeta).not.toHaveBeenCalled();
    expect(await syncPasskeyShieldedAccessData(storage, STORE.getWalletMeta())).toBe(false);
    expect(storage.saveAccessData).not.toHaveBeenCalled();
  });

  test('the ceremony unlock fails before the prompt', async () => {
    STORE.getWalletMeta.mockReturnValue({ walletType: 'passkey', xpub: XPUB });
    signInWalletWordsFromPasskey.mockResolvedValue({ words: WORDS, credentialId: null });

    await expect(unlockPasskeyShieldedKeys()).rejects.toThrow('cannot derive the shielded keys');
    expect(signInWalletWordsFromPasskey).not.toHaveBeenCalled();
  });
});

(libDerives ? describe : describe.skip)('the keys a passkey derives', () => {
  // A seed wallet imported from the same words derives its shielded keys in its access data: the
  // passkey wallet must derive the very same ones, so both share their shielded addresses.
  test('are the shielded keys of a seed wallet with the same words', () => {
    const seedAccessData = walletUtils.generateAccessDataFromSeed(WORDS, {
      pin: '123456',
      password: '123456',
      networkName: NETWORK_MAINNET,
    });

    const keys = derivePasskeyShieldedKeys(WORDS);

    expect(keys.shieldedXpubs).toEqual({
      scanXpubkey: seedAccessData.scanXpubkey,
      spendXpubkey: seedAccessData.spendXpubkey,
    });
    expect(walletUtils.getXPubKeyFromXPrivKey(keys.scanXPrivKey))
      .toBe(keys.shieldedXpubs.scanXpubkey);
  });

  test('go on the access data of the passkey wallet', async () => {
    const { shieldedXpubs } = derivePasskeyShieldedKeys(WORDS);
    const walletMeta = { walletType: 'passkey', xpub: XPUB, shieldedXpubs };
    const stored = { ...walletUtils.generateAccessDataFromXpub(XPUB), other: 'kept' };
    const storage = {
      getAccessData: jest.fn(async () => stored),
      saveAccessData: jest.fn(async () => {}),
    };

    expect(await syncPasskeyShieldedAccessData(storage, walletMeta)).toBe(true);

    expect(storage.saveAccessData).toHaveBeenCalledWith({ ...stored, ...shieldedXpubs });
  });
});

describe('rememberPasskeyShieldedKeys', () => {
  beforeEach(stubDerivers);

  test('stores the xpubs of a wallet that has none, and holds the scan key', () => {
    STORE.getWalletMeta.mockReturnValue({ walletType: 'passkey', xpub: XPUB });

    expect(rememberPasskeyShieldedKeys(WORDS)).toBe(SCAN_KEY);

    expect(STORE.updateWalletMeta).toHaveBeenCalledWith({ shieldedXpubs: XPUBS });
    expect(getPasskeyScanKey()).toBe(SCAN_KEY);
  });

  test('repairs xpubs that differ', () => {
    STORE.getWalletMeta.mockReturnValue({
      xpub: XPUB,
      shieldedXpubs: { ...XPUBS, spendXpubkey: 'xpub-other-spend' },
    });

    rememberPasskeyShieldedKeys(WORDS);

    expect(STORE.updateWalletMeta).toHaveBeenCalledWith({ shieldedXpubs: XPUBS });
  });

  test('writes nothing when the stored xpubs are the derived ones', () => {
    STORE.getWalletMeta.mockReturnValue({ xpub: XPUB, shieldedXpubs: { ...XPUBS } });

    expect(rememberPasskeyShieldedKeys(WORDS)).toBe(SCAN_KEY);

    expect(STORE.updateWalletMeta).not.toHaveBeenCalled();
  });

  // It runs inside the unlock ceremony, which must never fail because of it.
  test('gives null without throwing when the derivation throws', () => {
    STORE.getWalletMeta.mockReturnValue({ xpub: XPUB });
    walletUtils.deriveShieldedXpubs.mockImplementation(() => { throw new Error('boom'); });
    jest.spyOn(console, 'error').mockImplementation(() => {});

    expect(rememberPasskeyShieldedKeys(WORDS)).toBeNull();
    expect(getPasskeyScanKey()).toBeNull();
  });

  test('logs a failed metadata write, and still holds the key', async () => {
    STORE.getWalletMeta.mockReturnValue({ xpub: XPUB });
    STORE.updateWalletMeta.mockImplementation(() => Promise.reject(new Error('disk full')));
    const consoleError = jest.spyOn(console, 'error').mockImplementation(() => {});

    expect(rememberPasskeyShieldedKeys(WORDS)).toBe(SCAN_KEY);
    await new Promise((resolve) => { setImmediate(resolve); });

    expect(consoleError).toHaveBeenCalled();
    expect(getPasskeyScanKey()).toBe(SCAN_KEY);
  });
});

describe('the scan key held for the session', () => {
  test('is handed out only for the wallet it was derived for', () => {
    STORE.getWalletMeta.mockReturnValue({ xpub: XPUB });
    holdPasskeyScanKey(SCAN_KEY);
    expect(getPasskeyScanKey()).toBe(SCAN_KEY);

    STORE.getWalletMeta.mockReturnValue({ xpub: 'xpub-of-another-wallet' });
    expect(getPasskeyScanKey()).toBeNull();

    STORE.getWalletMeta.mockReturnValue(null);
    expect(getPasskeyScanKey()).toBeNull();
  });

  test('is dropped by clearPasskeyScanKey', () => {
    STORE.getWalletMeta.mockReturnValue({ xpub: XPUB });
    holdPasskeyScanKey(SCAN_KEY);

    clearPasskeyScanKey();

    expect(getPasskeyScanKey()).toBeNull();
  });
});

describe('getPasskeyShieldedXpubs', () => {
  beforeEach(stubDerivers);

  test('gives both xpubs, or null when either is missing', () => {
    expect(getPasskeyShieldedXpubs({ xpub: XPUB, shieldedXpubs: XPUBS })).toEqual(XPUBS);
    expect(getPasskeyShieldedXpubs({ xpub: XPUB })).toBeNull();
    expect(getPasskeyShieldedXpubs({ xpub: XPUB, shieldedXpubs: null })).toBeNull();
    expect(getPasskeyShieldedXpubs({
      xpub: XPUB,
      shieldedXpubs: { scanXpubkey: XPUBS.scanXpubkey },
    })).toBeNull();
    expect(getPasskeyShieldedXpubs(null)).toBeNull();
  });

  test('reads the stored metadata by default', () => {
    STORE.getWalletMeta.mockReturnValue({ xpub: XPUB, shieldedXpubs: XPUBS });
    expect(getPasskeyShieldedXpubs()).toEqual(XPUBS);
  });
});

describe('unlockPasskeyShieldedKeys', () => {
  beforeEach(stubDerivers);

  test('derives the keys in a ceremony of the loaded wallet, and holds the scan key', async () => {
    STORE.getWalletMeta.mockReturnValue({ walletType: 'passkey', xpub: XPUB });
    signInWalletWordsFromPasskey.mockResolvedValue({ words: WORDS, credentialId: null });

    expect(await unlockPasskeyShieldedKeys()).toBe(SCAN_KEY);

    expect(signInWalletWordsFromPasskey).toHaveBeenCalledTimes(1);
    expect(getPasskeyScanKey()).toBe(SCAN_KEY);
  });

  test('throws when no key was derived', async () => {
    STORE.getWalletMeta.mockReturnValue({ walletType: 'passkey', xpub: XPUB });
    signInWalletWordsFromPasskey.mockResolvedValue({ words: WORDS, credentialId: null });
    walletUtils.deriveShieldedScanXPrivKey.mockImplementation(() => { throw new Error('boom'); });
    jest.spyOn(console, 'error').mockImplementation(() => {});

    await expect(unlockPasskeyShieldedKeys()).rejects.toThrow();
    expect(getPasskeyScanKey()).toBeNull();
  });
});

describe('syncPasskeyShieldedAccessData', () => {
  const ACCESS_DATA = { xpubkey: 'xpub-change', walletType: 'p2pkh', walletFlags: 1 };

  beforeEach(() => {
    stubDerivers();
    // The lib validates the xpubs and gives the access data a start would create.
    jest.spyOn(walletUtils, 'generateAccessDataFromXpub')
      .mockImplementation((_xpub, xpubs) => ({ ...ACCESS_DATA, ...xpubs }));
  });

  const storageWith = (accessData) => ({
    getAccessData: jest.fn(async () => accessData),
    saveAccessData: jest.fn(async () => {}),
  });

  test('puts the stored xpubs on access data that lacks them, keeping its other fields', async () => {
    const storage = storageWith({ ...ACCESS_DATA, other: 'kept' });

    expect(await syncPasskeyShieldedAccessData(storage, { xpub: XPUB, shieldedXpubs: XPUBS }))
      .toBe(true);

    expect(walletUtils.generateAccessDataFromXpub).toHaveBeenCalledWith(XPUB, XPUBS);
    expect(storage.saveAccessData).toHaveBeenCalledWith({ ...ACCESS_DATA, other: 'kept', ...XPUBS });
  });

  test('saves nothing when the access data has them already', async () => {
    const storage = storageWith({ ...ACCESS_DATA, ...XPUBS });

    expect(await syncPasskeyShieldedAccessData(storage, { xpub: XPUB, shieldedXpubs: XPUBS }))
      .toBe(false);

    expect(storage.saveAccessData).not.toHaveBeenCalled();
  });

  test('creates the access data when there is none', async () => {
    const storage = storageWith(null);

    expect(await syncPasskeyShieldedAccessData(storage, { xpub: XPUB, shieldedXpubs: XPUBS }))
      .toBe(true);

    expect(storage.saveAccessData).toHaveBeenCalledWith({ ...ACCESS_DATA, ...XPUBS });
  });

  test('leaves a wallet without stored xpubs as it is', async () => {
    const storage = storageWith(ACCESS_DATA);

    expect(await syncPasskeyShieldedAccessData(storage, { xpub: XPUB })).toBe(false);

    expect(storage.getAccessData).not.toHaveBeenCalled();
    expect(storage.saveAccessData).not.toHaveBeenCalled();
  });
});
