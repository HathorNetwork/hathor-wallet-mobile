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
    // Returns a promise: the signer treats the credentialId backfill as fire-and-forget and
    // attaches a .catch(), so the mock must be thenable or that call would throw.
    updateWalletMeta: jest.fn(() => Promise.resolve()),
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
  PasskeyMetadataMissingError,
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

// A fake account-root xpriv shaped like the real one: BOTH derivation methods are stubbed so the
// resolver's 'spend' branch (deriveChild = compliant) and 'legacy' branch (deriveNonCompliantChild)
// can each run without throwing. The default happy-path tests mock signTxInputs and never invoke
// the resolver; the dedicated resolver test below builds its own asserting root.
const makeRoot = () => ({
  deriveChild: jest.fn(() => ({
    deriveChild: jest.fn(() => ({})),
  })),
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

  test('throws PasskeyMetadataMissingError (not mismatch) when no xpub is stored at all', async () => {
    // A missing stored xpub is corrupted/incomplete metadata, NOT a wrong passkey — it must be
    // diagnosed distinctly (reset, not "use the other passkey").
    STORE.getWalletMeta.mockReturnValue(makeMeta({ xpub: undefined }));

    const signer = makePasskeyTxSigner();
    const err = await signer(fakeTx, fakeStorage).catch((e) => e);

    expect(err).toBeInstanceOf(PasskeyMetadataMissingError);
    expect(err).not.toBeInstanceOf(PasskeyXpubMismatchError);
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

  test('the resolver derives the spend chain COMPLIANTLY and the legacy chain NON-compliantly', async () => {
    // signTxInputs is delegated to, but the per-chain key derivation lives in the resolver it gets
    // as its 3rd arg -- the deriveChild/deriveNonCompliantChild logic that was previously buggy.
    // The real signTxInputs invokes that resolver DURING signing (while the in-memory root is still
    // alive, before the finally nulls it), so drive it the same way via mockImplementation.
    const SPEND_LEAF = { chain: 'spend-leaf' };
    const LEGACY_LEAF = { chain: 'legacy-leaf' };
    const spendAcct = { deriveChild: jest.fn(() => SPEND_LEAF) };
    const legacyAcct = { deriveNonCompliantChild: jest.fn(() => LEGACY_LEAF) };
    const root = {
      deriveChild: jest.fn(() => spendAcct),
      deriveNonCompliantChild: jest.fn(() => legacyAcct),
    };
    walletUtils.getXPrivKeyFromSeed.mockReturnValue(root);

    const derived = {};
    transactionUtils.signTxInputs.mockImplementation(async (_tx, _storage, resolver) => {
      derived.spend = await resolver('spend');
      derived.legacy = await resolver('legacy');
      return { inputSignatures: [], ncCallerSignature: null };
    });

    const signer = makePasskeyTxSigner();
    await signer(fakeTx, fakeStorage);

    // 'spend' (shielded) uses the COMPLIANT path: deriveChild(SHIELDED path) then deriveChild(0).
    // Called exactly once => the shielded branch never touched the legacy (non-compliant) path.
    expect(derived.spend).toBe(SPEND_LEAF);
    expect(root.deriveChild).toHaveBeenCalledTimes(1);
    expect(root.deriveChild).toHaveBeenCalledWith("m/44'/280'/2'");
    expect(spendAcct.deriveChild).toHaveBeenCalledWith(0);

    // 'legacy' (P2PKH) uses the NON-COMPLIANT path: deriveNonCompliantChild(P2PKH path) then (0).
    expect(derived.legacy).toBe(LEGACY_LEAF);
    expect(root.deriveNonCompliantChild).toHaveBeenCalledTimes(1);
    expect(root.deriveNonCompliantChild).toHaveBeenCalledWith("m/44'/280'/0'");
    expect(legacyAcct.deriveNonCompliantChild).toHaveBeenCalledWith(0);
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

  test('backfills a newly-learned credentialId (mirrors the signer backfill)', async () => {
    // The unlock ceremony returns a credentialId not yet stored; it should be persisted so the
    // next ceremony can skip the OS passkey picker.
    signInWalletWordsFromPasskey.mockResolvedValue({ words: WORDS, credentialId: 'new-cred' });

    await expect(verifyPasskeyForUnlock()).resolves.toBeUndefined();

    expect(STORE.updateWalletMeta).toHaveBeenCalledWith({ credentialId: 'new-cred' });
  });

  test('does not rewrite an unchanged credentialId', async () => {
    // Ceremony returns the SAME credentialId already stored -> no metadata write.
    await expect(verifyPasskeyForUnlock()).resolves.toBeUndefined();

    expect(STORE.updateWalletMeta).not.toHaveBeenCalled();
  });
});
