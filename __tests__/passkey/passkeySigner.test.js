import { jest, describe, test, expect, beforeEach } from '@jest/globals';

// --- External boundaries the signer touches, all mocked so the tests are deterministic and
// need no device / native passkey module / async storage. Each factory builds its jest.fn()
// inline (referencing `jest` is allowed inside a mock factory) so there is no temporal-dead-zone
// issue with out-of-scope variables when the factory runs during module resolution.

// NETWORK_MAINNET is the only constant the signer reads; mock it to avoid loading the real
// constants.js (which pulls `intl` and app config).
jest.mock('../../src/constants', () => ({ NETWORK_MAINNET: 'mainnet' }));

// The wallet meta store. The signer reads getWalletMeta() (xpub + label + credentialId) and may
// backfill credentialId via updateWalletMeta().
jest.mock('../../src/store', () => ({
  STORE: {
    getWalletMeta: jest.fn(),
    updateWalletMeta: jest.fn(),
  },
}));

// wallet-lib pieces: xpub/xpriv derivation and the delegated input-signing loop.
jest.mock('@hathor/wallet-lib', () => ({
  constants: {
    SHIELDED_SPEND_ACCT_PATH: "m/44'/280'/2'",
    P2PKH_ACCT_PATH: "m/44'/280'/0'",
  },
  transactionUtils: {
    signTxInputs: jest.fn(),
  },
  walletUtils: {
    getXPubKeyFromSeed: jest.fn(),
    getXPrivKeyFromSeed: jest.fn(),
  },
}));

// The passkey ceremony boundary (native react-native-passkey lives behind this service).
// sanitizePasskeyLabel mirrors the real behaviour just enough for the label assertions to be
// meaningful (used by PasskeyXpubMismatchError to compute the label it carries).
jest.mock('../../src/passkey/passkeyService', () => ({
  signInWalletWordsFromPasskey: jest.fn(),
  isPasskeyCancel: jest.fn(),
  sanitizePasskeyLabel: jest.fn((label) => {
    if (!label || typeof label !== 'string') return null;
    const trimmed = label.trim();
    return trimmed || null;
  }),
}));

/* eslint-disable import/first, import/order */
import { walletUtils, transactionUtils } from '@hathor/wallet-lib';
import { STORE } from '../../src/store';
import { signInWalletWordsFromPasskey, isPasskeyCancel } from '../../src/passkey/passkeyService';
import {
  makePasskeyTxSigner,
  verifyPasskeyForUnlock,
  consumePasskeySigningCancelled,
  PasskeyCancelledError,
  PasskeyXpubMismatchError,
  PasskeyBusyError,
} from '../../src/passkey/passkeySigner';
/* eslint-enable import/first, import/order */

const STORED_XPUB = 'xpub-stored-THIS-wallet';
const OTHER_XPUB = 'xpub-of-a-DIFFERENT-wallet';
const STORED_LABEL = 'My Hathor Wallet';
const STORED_CRED = 'credential-id-1';
// 24 placeholder BIP39-ish words; content is irrelevant since derivation is mocked.
const WORDS = new Array(24).fill('abandon').join(' ');

const makeMeta = (overrides = {}) => ({
  walletType: 'passkey',
  xpub: STORED_XPUB,
  passkeyLabel: STORED_LABEL,
  credentialId: STORED_CRED,
  ...overrides,
});

// A fake account-root xpriv whose derivation chain never actually runs in these tests
// (signTxInputs is mocked and does not invoke the resolver), but is shaped correctly just in case.
const makeRoot = () => ({
  deriveNonCompliantChild: jest.fn(() => ({
    deriveNonCompliantChild: jest.fn(() => ({})),
  })),
});

const fakeTx = { hash: 'tx' };
const fakeStorage = { getTxSignatures: jest.fn() };

beforeEach(() => {
  jest.clearAllMocks();
  // Happy-path defaults: the ceremony succeeds, nothing is cancelled, the derived xpub matches
  // the stored one, and signing delegates cleanly. Individual tests override the relevant piece.
  STORE.getWalletMeta.mockReturnValue(makeMeta());
  signInWalletWordsFromPasskey.mockResolvedValue({ words: WORDS, credentialId: STORED_CRED });
  isPasskeyCancel.mockReturnValue(false);
  walletUtils.getXPubKeyFromSeed.mockReturnValue(STORED_XPUB);
  walletUtils.getXPrivKeyFromSeed.mockReturnValue(makeRoot());
  transactionUtils.signTxInputs.mockResolvedValue({ inputSignatures: [], ncCallerSignature: null });
});

describe('makePasskeyTxSigner', () => {
  test('throws PasskeyXpubMismatchError when the ceremony opens a different wallet', async () => {
    // The passkey ceremony succeeds but derives an xpub that does NOT match the stored wallet.
    walletUtils.getXPubKeyFromSeed.mockReturnValue(OTHER_XPUB);

    const signer = makePasskeyTxSigner();
    const err = await signer(fakeTx, fakeStorage, 'ignored-pin').catch((e) => e);

    expect(err).toBeInstanceOf(PasskeyXpubMismatchError);
    expect(err.name).toBe('PasskeyXpubMismatchError');
    // The anti-wallet-switch guard fires BEFORE any signing is attempted.
    expect(transactionUtils.signTxInputs).not.toHaveBeenCalled();
    // It carries the stored passkey label so the UI can name the correct passkey.
    expect(err.storedLabel).toBe(STORED_LABEL);
  });

  test('throws PasskeyXpubMismatchError when no xpub is stored at all', async () => {
    STORE.getWalletMeta.mockReturnValue(makeMeta({ xpub: undefined }));

    const signer = makePasskeyTxSigner();
    const err = await signer(fakeTx, fakeStorage).catch((e) => e);

    expect(err).toBeInstanceOf(PasskeyXpubMismatchError);
    expect(transactionUtils.signTxInputs).not.toHaveBeenCalled();
  });

  test('throws PasskeyCancelledError when the ceremony is cancelled', async () => {
    const cancelError = { error: 'UserCancelled' };
    signInWalletWordsFromPasskey.mockRejectedValue(cancelError);
    isPasskeyCancel.mockReturnValue(true);

    const signer = makePasskeyTxSigner();
    const err = await signer(fakeTx, fakeStorage).catch((e) => e);

    expect(err).toBeInstanceOf(PasskeyCancelledError);
    expect(err.name).toBe('PasskeyCancelledError');
    expect(transactionUtils.signTxInputs).not.toHaveBeenCalled();
    // The cancelled flag is set for the saga to read-and-reset.
    expect(consumePasskeySigningCancelled()).toBe(true);
    // ...and consuming it clears it.
    expect(consumePasskeySigningCancelled()).toBe(false);
  });

  test('re-throws a non-cancel ceremony error unchanged (not wrapped as cancelled)', async () => {
    const realFailure = new Error('native passkey exploded');
    signInWalletWordsFromPasskey.mockRejectedValue(realFailure);
    isPasskeyCancel.mockReturnValue(false);

    const signer = makePasskeyTxSigner();
    const err = await signer(fakeTx, fakeStorage).catch((e) => e);

    expect(err).toBe(realFailure);
    expect(err).not.toBeInstanceOf(PasskeyCancelledError);
    expect(consumePasskeySigningCancelled()).toBe(false);
  });

  test('throws PasskeyBusyError when a second signing overlaps an in-flight one (single-flight)', async () => {
    // Leave the FIRST ceremony's promise unresolved so the first call stays in-flight while the
    // second call is made — this is the genuine concurrent-overlap the busy guard protects against.
    let resolveCeremony;
    signInWalletWordsFromPasskey.mockReturnValueOnce(
      new Promise((resolve) => { resolveCeremony = resolve; })
    );

    const signer = makePasskeyTxSigner();

    // Kick off the first call. Its synchronous prologue sets the in-flight flag, then it suspends
    // awaiting the (still pending) ceremony promise.
    const first = signer(fakeTx, fakeStorage);

    // A concurrent second call must fail fast, WITHOUT starting another ceremony.
    const busyErr = await signer(fakeTx, fakeStorage).catch((e) => e);
    expect(busyErr).toBeInstanceOf(PasskeyBusyError);
    expect(busyErr.name).toBe('PasskeyBusyError');
    // Only the first call reached the ceremony; the busy call short-circuited before it.
    expect(signInWalletWordsFromPasskey).toHaveBeenCalledTimes(1);

    // Let the first call complete so the single-flight guard is released.
    resolveCeremony({ words: WORDS, credentialId: STORED_CRED });
    await expect(first).resolves.toEqual({ inputSignatures: [], ncCallerSignature: null });

    // The guard (module-level signingInFlight) is per-completion, not permanent: reusing the SAME
    // signer after the first finishes proceeds — a stuck flag would throw PasskeyBusyError here.
    const after = await signer(fakeTx, fakeStorage).catch((e) => e);
    expect(after).not.toBeInstanceOf(PasskeyBusyError);
  });

  test('happy path backfills credentialId and delegates to transactionUtils.signTxInputs', async () => {
    // Ceremony returns a NEW credentialId (learned on this device); it should be persisted.
    signInWalletWordsFromPasskey.mockResolvedValue({ words: WORDS, credentialId: 'new-cred' });

    const signer = makePasskeyTxSigner();
    const result = await signer(fakeTx, fakeStorage);

    expect(STORE.updateWalletMeta).toHaveBeenCalledWith({ credentialId: 'new-cred' });
    expect(transactionUtils.signTxInputs).toHaveBeenCalledTimes(1);
    expect(transactionUtils.signTxInputs.mock.calls[0][0]).toBe(fakeTx);
    expect(transactionUtils.signTxInputs.mock.calls[0][1]).toBe(fakeStorage);
    expect(result).toEqual({ inputSignatures: [], ncCallerSignature: null });
  });
});

describe('verifyPasskeyForUnlock', () => {
  test('resolves when the ceremony opens THIS wallet', async () => {
    await expect(verifyPasskeyForUnlock()).resolves.toBeUndefined();
  });

  test('throws PasskeyXpubMismatchError when the passkey opens a different wallet', async () => {
    walletUtils.getXPubKeyFromSeed.mockReturnValue(OTHER_XPUB);

    const err = await verifyPasskeyForUnlock().catch((e) => e);

    expect(err).toBeInstanceOf(PasskeyXpubMismatchError);
    expect(err.storedLabel).toBe(STORED_LABEL);
  });

  test('throws PasskeyCancelledError when the ceremony is cancelled', async () => {
    signInWalletWordsFromPasskey.mockRejectedValue({ error: 'UserCancelled' });
    isPasskeyCancel.mockReturnValue(true);

    const err = await verifyPasskeyForUnlock().catch((e) => e);

    expect(err).toBeInstanceOf(PasskeyCancelledError);
  });
});
