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
  EXPECTED_NATIVE_CODES: ['NoCredentials', 'TimedOut', 'Interrupted'],
  signInWalletWordsFromPasskey: jest.fn(),
  isPasskeyCancel: jest.fn(),
  PasskeyNativeError: class PasskeyNativeError extends Error {
    constructor(nativeError) {
      super(nativeError?.message);
      this.code = nativeError?.error ?? null;
    }
  },
  sanitizePasskeyLabel: jest.fn((label) => {
    if (!label || typeof label !== 'string') return null;
    const trimmed = label.trim();
    return trimmed || null;
  }),
}));

/* eslint-disable import/first, import/order */
import { walletUtils, transactionUtils } from '@hathor/wallet-lib';
import { STORE } from '../../src/store';
import {
  signInWalletWordsFromPasskey,
  isPasskeyCancel,
  PasskeyNativeError,
} from '../../src/passkey/passkeyService';
import {
  authorizePasskeyPrivateKey,
  canSignWithPasskeyPrivateKey,
  clearPasskeyPrivateKeyAuthorization,
  isExpectedPasskeyError,
  makePasskeyPrivateKeyProvider,
  passkeyConsentForRequest,
  makePasskeyTxSigner,
  verifyPasskeyForUnlock,
  consumePasskeySigningCancelled,
  PasskeyCancelledError,
  PasskeyXpubMismatchError,
  PasskeyMetadataMissingError,
  PasskeyBusyError,
  PasskeySigningUnsupportedError,
  withPasskeyWords,
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
    // Checked BEFORE the ceremony: the user is not asked to authenticate for a signature that
    // could never be verified.
    expect(signInWalletWordsFromPasskey).not.toHaveBeenCalled();
  });

  test('throws PasskeySigningUnsupportedError before the ceremony when the lib lacks signTxInputs', async () => {
    // The pinned wallet-lib predates transactionUtils.signTxInputs; the signer must fail cleanly
    // (not with a TypeError mid-signing) and without prompting for biometrics.
    const original = transactionUtils.signTxInputs;
    transactionUtils.signTxInputs = undefined;
    try {
      const signer = makePasskeyTxSigner();
      const err = await signer(fakeTx, fakeStorage).catch((e) => e);

      expect(err).toBeInstanceOf(PasskeySigningUnsupportedError);
      expect(signInWalletWordsFromPasskey).not.toHaveBeenCalled();
    } finally {
      transactionUtils.signTxInputs = original;
    }
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
    consumePasskeySigningCancelled(); // start from a clean flag

    const err = await verifyPasskeyForUnlock().catch((e) => e);

    expect(err).toBeInstanceOf(PasskeyCancelledError);
    // Only a SIGNING cancel sets the flag; otherwise a cancelled unlock would make the next failed
    // Reown request read as a user cancel.
    expect(consumePasskeySigningCancelled()).toBe(false);
  });

  test('throws PasskeyMetadataMissingError without prompting when no xpub is stored', async () => {
    STORE.getWalletMeta.mockReturnValue(makeMeta({ xpub: undefined }));

    const err = await verifyPasskeyForUnlock().catch((e) => e);

    expect(err).toBeInstanceOf(PasskeyMetadataMissingError);
    expect(signInWalletWordsFromPasskey).not.toHaveBeenCalled();
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

describe('withPasskeyWords', () => {
  test('runs fn with the derived words and returns its result', async () => {
    const fn = jest.fn(async (words) => `used:${words.split(' ').length}`);

    await expect(withPasskeyWords(fn)).resolves.toBe('used:24');

    expect(fn).toHaveBeenCalledWith(WORDS);
    // The stored credentialId is passed so the OS skips the passkey picker.
    expect(signInWalletWordsFromPasskey).toHaveBeenCalledWith({ credentialId: STORED_CRED });
  });

  test('a cancel throws PasskeyCancelledError, calls onCancel and never runs fn', async () => {
    signInWalletWordsFromPasskey.mockRejectedValue({ error: 'UserCancelled' });
    isPasskeyCancel.mockReturnValue(true);
    const fn = jest.fn();
    const onCancel = jest.fn();
    consumePasskeySigningCancelled(); // start from a clean flag

    const err = await withPasskeyWords(fn, { onCancel }).catch((e) => e);

    expect(err).toBeInstanceOf(PasskeyCancelledError);
    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(fn).not.toHaveBeenCalled();
    // The helper leaves the signing-cancel flag alone (only the signer's onCancel sets it), so a
    // cancelled push or unlock sheet can't make the next failed Reown request read as a cancel.
    expect(consumePasskeySigningCancelled()).toBe(false);
  });

  test('a passkey for a different wallet throws PasskeyXpubMismatchError and never runs fn', async () => {
    walletUtils.getXPubKeyFromSeed.mockReturnValue(OTHER_XPUB);
    const fn = jest.fn();

    const err = await withPasskeyWords(fn).catch((e) => e);

    expect(err).toBeInstanceOf(PasskeyXpubMismatchError);
    expect(fn).not.toHaveBeenCalled();
  });

  test('missing stored xpub throws PasskeyMetadataMissingError before any prompt', async () => {
    STORE.getWalletMeta.mockReturnValue(makeMeta({ xpub: undefined }));
    const fn = jest.fn();

    const err = await withPasskeyWords(fn).catch((e) => e);

    expect(err).toBeInstanceOf(PasskeyMetadataMissingError);
    expect(signInWalletWordsFromPasskey).not.toHaveBeenCalled();
    expect(fn).not.toHaveBeenCalled();
  });

  test('a concurrent call while one is in flight throws PasskeyBusyError', async () => {
    let finishFirst;
    signInWalletWordsFromPasskey.mockReturnValueOnce(new Promise((resolve) => {
      finishFirst = () => resolve({ words: WORDS, credentialId: STORED_CRED });
    }));
    const first = withPasskeyWords(async () => 'first');

    await expect(withPasskeyWords(async () => 'second')).rejects.toBeInstanceOf(PasskeyBusyError);

    finishFirst();
    await expect(first).resolves.toBe('first');
  });

  test('backfills a newly-learned credentialId', async () => {
    signInWalletWordsFromPasskey.mockResolvedValue({ words: WORDS, credentialId: 'new-cred' });

    await withPasskeyWords(async () => {});

    expect(STORE.updateWalletMeta).toHaveBeenCalledWith({ credentialId: 'new-cred' });
  });

  test('releases the lock when fn throws, so the next ceremony can run', async () => {
    const boom = new Error('fn failed');

    await expect(withPasskeyWords(async () => { throw boom; })).rejects.toBe(boom);
    await expect(withPasskeyWords(async () => 'next')).resolves.toBe('next');
  });
});

describe('Phase 2 hooks', () => {
  test('makePasskeyTxSigner runs onRootKey with the root inside the ceremony, before signing', async () => {
    const order = [];
    const root = makeRoot();
    walletUtils.getXPrivKeyFromSeed.mockReturnValue(root);
    transactionUtils.signTxInputs.mockImplementation(async () => {
      order.push('sign');
      return { inputSignatures: [], ncCallerSignature: null };
    });
    const onRootKey = jest.fn(async () => { order.push('onRootKey'); });

    await makePasskeyTxSigner({ onRootKey })(fakeTx, fakeStorage);

    expect(onRootKey).toHaveBeenCalledWith(root);
    expect(order).toEqual(['onRootKey', 'sign']);
    // One ceremony for both the token and the signature.
    expect(signInWalletWordsFromPasskey).toHaveBeenCalledTimes(1);
  });

  test('a failing onRootKey aborts the send before signing', async () => {
    const onRootKey = jest.fn(async () => { throw new Error('token refresh failed'); });

    await expect(makePasskeyTxSigner({ onRootKey })(fakeTx, fakeStorage))
      .rejects.toThrow('token refresh failed');
    expect(transactionUtils.signTxInputs).not.toHaveBeenCalled();
  });

  test('verifyPasskeyForUnlock passes the words to onWords and resolves with its result', async () => {
    const prepared = { tempWallet: {}, walletServiceUrl: 'https://ws.example/' };
    const onWords = jest.fn(() => prepared);

    // The result comes back so slow follow-up work can run after the passkey lock is released.
    await expect(verifyPasskeyForUnlock({ onWords })).resolves.toBe(prepared);

    expect(onWords).toHaveBeenCalledWith(WORDS);
    expect(signInWalletWordsFromPasskey).toHaveBeenCalledTimes(1);
  });

  test('verifyPasskeyForUnlock resolves with undefined without onWords', async () => {
    await expect(verifyPasskeyForUnlock()).resolves.toBeUndefined();
  });
});

describe('isExpectedPasskeyError', () => {
  // Expected, user-correctable outcomes: screens show them and don't report them.
  test.each([
    ['a wrong passkey', new PasskeyXpubMismatchError('Savings')],
    ['a ceremony already open', new PasskeyBusyError()],
    ['a build that cannot sign from a passkey', new PasskeySigningUnsupportedError()],
    ['a deleted or unsynced passkey', new PasskeyNativeError({ error: 'NoCredentials', message: 'x' })],
    ['a timed-out ceremony', new PasskeyNativeError({ error: 'TimedOut', message: 'x' })],
    ['an interrupted ceremony', new PasskeyNativeError({ error: 'Interrupted', message: 'x' })],
  ])('%s is expected', (_case, error) => {
    expect(isExpectedPasskeyError(error)).toBe(true);
  });

  // Anything else is unexpected and gets reported.
  test.each([
    ['corrupted wallet metadata', new PasskeyMetadataMissingError()],
    ['an unknown native error', new PasskeyNativeError({ error: 'Unknown error', message: 'x' })],
    ['a bad app configuration', new PasskeyNativeError({ error: 'BadConfiguration', message: 'x' })],
    ['a plain Error', new Error('boom')],
    ['a non-Error value', { error: 'NoCredentials' }],
  ])('%s is not expected', (_case, error) => {
    expect(isExpectedPasskeyError(error)).toBe(false);
  });
});

describe('passkey private key for message and oracle signing', () => {
  // A root whose derived keys are labelled by path, so the tests can see which key was handed out.
  const makeLabelledRoot = () => ({
    deriveNonCompliantChild: jest.fn((acct) => ({
      deriveNonCompliantChild: jest.fn((chain) => ({
        deriveNonCompliantChild: jest.fn((index) => ({ privateKey: `${acct}/${chain}/${index}` })),
      })),
    })),
  });

  beforeEach(() => {
    clearPasskeyPrivateKeyAuthorization();
    consumePasskeySigningCancelled();
  });

  test('one ceremony authorizes one signature with the key of the requested address', async () => {
    walletUtils.getXPrivKeyFromSeed.mockReturnValue(makeLabelledRoot());
    const provider = makePasskeyPrivateKeyProvider();

    await authorizePasskeyPrivateKey();

    expect(signInWalletWordsFromPasskey).toHaveBeenCalledTimes(1);
    await expect(provider(5)).resolves.toBe("m/44'/280'/0'/0/5");
    // Never reused: a second signature needs a new ceremony.
    await expect(provider(5)).rejects.toThrow('No passkey authorization');
  });

  test('the provider refuses without an authorization, without prompting', async () => {
    await expect(makePasskeyPrivateKeyProvider()(0)).rejects.toThrow('No passkey authorization');
    expect(signInWalletWordsFromPasskey).not.toHaveBeenCalled();
  });

  test('clearing drops an unused authorization', async () => {
    walletUtils.getXPrivKeyFromSeed.mockReturnValue(makeLabelledRoot());
    await authorizePasskeyPrivateKey();

    clearPasskeyPrivateKeyAuthorization();

    await expect(makePasskeyPrivateKeyProvider()(0)).rejects.toThrow('No passkey authorization');
  });

  test('runs onRootKey with the root inside the same ceremony', async () => {
    const root = makeLabelledRoot();
    walletUtils.getXPrivKeyFromSeed.mockReturnValue(root);
    const onRootKey = jest.fn(async () => {});

    await authorizePasskeyPrivateKey({ onRootKey });

    expect(onRootKey).toHaveBeenCalledWith(root);
    expect(signInWalletWordsFromPasskey).toHaveBeenCalledTimes(1);
  });

  test('a failing onRootKey (e.g. the full-token mint) leaves no authorization', async () => {
    walletUtils.getXPrivKeyFromSeed.mockReturnValue(makeLabelledRoot());
    const onRootKey = jest.fn(async () => { throw new Error('token refresh failed'); });

    await expect(authorizePasskeyPrivateKey({ onRootKey })).rejects.toThrow('token refresh failed');
    await expect(makePasskeyPrivateKeyProvider()(0)).rejects.toThrow('No passkey authorization');
  });

  test('a cancel sets the signing-cancel flag and leaves no authorization', async () => {
    signInWalletWordsFromPasskey.mockRejectedValue({ error: 'UserCancelled' });
    isPasskeyCancel.mockReturnValue(true);

    await expect(authorizePasskeyPrivateKey()).rejects.toBeInstanceOf(PasskeyCancelledError);

    expect(consumePasskeySigningCancelled()).toBe(true);
    await expect(makePasskeyPrivateKeyProvider()(0)).rejects.toThrow('No passkey authorization');
  });

  // Real wallet-lib derivation: the provider's key must be the one behind the wallet's own address
  // at that index (path m/44'/280'/0'/0/<index>, derived non-compliantly), or wallet-lib's
  // ownership check would reject it.
  test("hands out the key of the wallet's own address at the index", async () => {
    const lib = jest.requireActual('@hathor/wallet-lib');
    const words = lib.walletUtils.generateWalletWords();
    signInWalletWordsFromPasskey.mockResolvedValue({ words, credentialId: STORED_CRED });
    walletUtils.getXPrivKeyFromSeed.mockImplementation(lib.walletUtils.getXPrivKeyFromSeed);

    await authorizePasskeyPrivateKey();
    const key = await makePasskeyPrivateKeyProvider()(7);

    const accountXpub = lib.walletUtils.getXPubKeyFromSeed(words, { networkName: 'mainnet' });
    const { base58 } = lib.addressUtils.deriveAddressFromXPubP2PKH(
      lib.walletUtils.xpubDeriveChild(accountXpub, 0),
      7,
      'mainnet',
    );
    expect(key.toAddress(new lib.Network('mainnet').bitcoreNetwork).toString()).toBe(base58);
  });

  describe('passkeyConsentForRequest', () => {
    test('tx requests need no ceremony at the PIN step', async () => {
      await expect(passkeyConsentForRequest({ needsPrivateKey: false }))
        .resolves.toEqual({ accepted: true, pinCode: '' });
      expect(signInWalletWordsFromPasskey).not.toHaveBeenCalled();
    });

    test('a message or oracle request is authorized, with the full-token hook', async () => {
      walletUtils.getXPrivKeyFromSeed.mockReturnValue(makeLabelledRoot());
      const onRootKey = jest.fn(async () => {});

      await expect(passkeyConsentForRequest({ needsPrivateKey: true, onRootKey }))
        .resolves.toEqual({ accepted: true, pinCode: '' });

      expect(onRootKey).toHaveBeenCalledTimes(1);
      await expect(makePasskeyPrivateKeyProvider()(1)).resolves.toBe("m/44'/280'/0'/0/1");
    });

    test('a dismissed sheet answers false so the request can be retried', async () => {
      signInWalletWordsFromPasskey.mockRejectedValue({ error: 'UserCancelled' });
      isPasskeyCancel.mockReturnValue(true);

      await expect(passkeyConsentForRequest({ needsPrivateKey: true }))
        .resolves.toEqual({ accepted: false, pinCode: null });
      expect(consumePasskeySigningCancelled()).toBe(true);
    });

    test('other ceremony errors are thrown', async () => {
      walletUtils.getXPubKeyFromSeed.mockReturnValue(OTHER_XPUB);

      await expect(passkeyConsentForRequest({ needsPrivateKey: true }))
        .rejects.toBeInstanceOf(PasskeyXpubMismatchError);
    });
  });

  test('canSignWithPasskeyPrivateKey needs a registered provider', () => {
    expect(canSignWithPasskeyPrivateKey(undefined)).toBe(false);
    expect(canSignWithPasskeyPrivateKey({ storage: {} })).toBe(false); // wallet-lib 3.1.1
    const withProvider = (registered) => ({ storage: { hasPrivateKeyMethod: () => registered } });
    expect(canSignWithPasskeyPrivateKey(withProvider(false))).toBe(false);
    expect(canSignWithPasskeyPrivateKey(withProvider(true))).toBe(true);
  });
});
