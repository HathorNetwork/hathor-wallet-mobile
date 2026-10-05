/**
 * Copyright (c) Hathor Labs and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * External transaction signer for passkey (PIN-less, xpub-only) wallets.
 *
 * These wallets are started read-only from the account xpub; no seed or private key is ever
 * persisted. When wallet-lib needs signatures (storage.getTxSignatures), the callback built by
 * makePasskeyTxSigner() runs the WebAuthn PRF ceremony, re-derives the BIP39 seed in memory,
 * verifies it belongs to THIS wallet (derived xpub === stored xpub), then delegates the actual
 * signing to wallet-lib's transactionUtils.signTxInputs (supplying the ceremony-derived chain
 * xprivs), and discards all key material before returning. Register it via
 * wallet.setExternalTxSigningMethod() before the first send/sign; wallet-lib re-checks isReadonly()
 * per operation, so ordering relative to wallet.start() is not enforced (we do it before start()
 * as a safe convention).
 */

import { t } from 'ttag';
import { constants as hathorConstants, transactionUtils, walletUtils } from '@hathor/wallet-lib';
import { NETWORK_MAINNET } from '../constants';
import { STORE } from '../store';
import { logger } from '../logger';
import {
  signInWalletWordsFromPasskey,
  isPasskeyCancel,
  sanitizePasskeyLabel,
} from './passkeyService';

const log = logger('passkey-signer');

export class PasskeyCancelledError extends Error {
  constructor() {
    super(t`Passkey authorization was cancelled. Nothing was sent.`);
    this.name = 'PasskeyCancelledError';
  }
}

export class PasskeyXpubMismatchError extends Error {
  constructor(storedLabel) {
    // Labels persisted from old-format credentials may be decode garbage; never show those.
    const label = sanitizePasskeyLabel(storedLabel);
    super(label
      ? t`This passkey opens a different wallet. Use the passkey named "${label}".`
      : t`This passkey opens a different wallet. Use the passkey that created this wallet.`);
    this.name = 'PasskeyXpubMismatchError';
    this.storedLabel = label;
  }
}

export class PasskeyBusyError extends Error {
  constructor() {
    super(t`Another passkey authorization is already in progress.`);
    this.name = 'PasskeyBusyError';
  }
}

// Distinct from PasskeyXpubMismatchError: a MISSING stored xpub means the wallet metadata is
// corrupted or was never fully written (the xpub is the wallet's only persisted identity), NOT that
// the user presented the wrong passkey. The two need different guidance — reset here vs "use the
// other passkey" there — and this case should be reported as corruption, not shown as a mismatch.
export class PasskeyMetadataMissingError extends Error {
  constructor() {
    super(t`Passkey wallet data is missing or corrupted. Reset the wallet and sign in again with your passkey.`);
    this.name = 'PasskeyMetadataMissingError';
  }
}

// The bundled wallet-lib can't service an external passkey signer (it predates
// transactionUtils.signTxInputs). Thrown BEFORE the biometric prompt, so the user isn't asked to
// authenticate for a signature that can never be produced.
export class PasskeySigningUnsupportedError extends Error {
  constructor() {
    super(t`Sending from a passkey wallet isn't supported in this version of the app yet.`);
    this.name = 'PasskeySigningUnsupportedError';
  }
}

/**
 * The ONE xpub derivation used everywhere (onboarding, unlock verification, signing):
 * account-path xpub (m/44'/280'/0') — exactly what generateAccessDataFromXpub expects,
 * so string equality against the stored xpub is a valid identity check.
 *
 * @param {string} words BIP39 seed phrase derived from the passkey PRF secret
 * @returns {string} account-path xpubkey
 */
export function derivePasskeyXpub(words) {
  return walletUtils.getXPubKeyFromSeed(words, {
    networkName: NETWORK_MAINNET,
    accountDerivationIndex: "0'",
  });
}

// Module-level single-flight guard: the OS shows one credential sheet at a time; a second
// concurrent ceremony (double-tap through a path without a screen-level guard) must fail fast.
let signingInFlight = false;

// The reown saga cannot rely on `instanceof` or message matching to detect a cancelled
// ceremony: the rpc-handler re-wraps errors and messages are translated. This flag mirrors
// the saga's own `pinWasCancelled` pattern — set when a SIGNING ceremony is cancelled,
// consumed (read-and-reset) by the caller. It is reset at the start of every ceremony so it
// always reflects the most recent one.
let signingCancelled = false;

/** Read-and-reset: whether the most recent signing ceremony was cancelled by the user. */
export function consumePasskeySigningCancelled() {
  const value = signingCancelled;
  signingCancelled = false;
  return value;
}

/**
 * Run a passkey ceremony under the single-flight guard. The OS shows one credential sheet at a
 * time, so a second concurrent ceremony — a double-tap, or an unlock overlapping a signing
 * ceremony — must fail fast with PasskeyBusyError instead of opening a second sheet. Used by BOTH
 * the tx signer and the unlock check, so the guard actually covers every entry point.
 */
async function withPasskeyLock(fn) {
  if (signingInFlight) {
    throw new PasskeyBusyError();
  }
  signingInFlight = true;
  try {
    return await fn();
  } finally {
    signingInFlight = false;
  }
}

/**
 * Run ONE passkey ceremony for THIS wallet and hand the derived seed words to `fn`.
 *
 * Shared by the tx signer, the unlock check and push registration, so they all apply the same
 * checks: the single-flight lock, the stored credentialId (no OS picker), cancel mapping, the
 * missing-metadata and xpub-identity checks, and the best-effort credentialId backfill.
 *
 * @template T
 * @param {(words: string) => Promise<T>} fn Runs while the words are in memory.
 * @param {{ onCancel?: () => void }} [options] `onCancel` runs when the user dismisses the sheet.
 * @returns {Promise<T>}
 */
export function withPasskeyWords(fn, { onCancel } = {}) {
  return withPasskeyLock(async () => {
    const meta = STORE.getWalletMeta();
    // Check the stored identity BEFORE the ceremony: without it the result can't be verified, so
    // prompting for biometrics first would only waste the user's authentication.
    if (!meta?.xpub) {
      throw new PasskeyMetadataMissingError();
    }
    let words = null;
    let credentialId = null;
    try {
      // Passing the stored credentialId skips the OS passkey picker and prompts biometrics for
      // THIS wallet's credential directly.
      ({ words, credentialId } = await signInWalletWordsFromPasskey({
        credentialId: meta.credentialId,
      }));
    } catch (e) {
      if (isPasskeyCancel(e)) {
        onCancel?.();
        throw new PasskeyCancelledError();
      }
      throw e;
    }
    try {
      if (derivePasskeyXpub(words) !== meta.xpub) {
        throw new PasskeyXpubMismatchError(meta.passkeyLabel);
      }
      // Wallets signed in before credentialId was captured (or on another device) learn it here,
      // so the next ceremony can skip the picker too. Best-effort: fire-and-forget and log (never
      // block or fail the operation) if the write rejects.
      if (credentialId && credentialId !== meta.credentialId) {
        STORE.updateWalletMeta({ credentialId }).catch((e) => log.error('credentialId backfill failed', e));
      }
      return await fn(words);
    } finally {
      // JS cannot zero string memory; dropping the reference as soon as possible is the best
      // available hygiene.
      words = null;
    }
  });
}

/**
 * Build the EcdsaTxSign callback for wallet.setExternalTxSigningMethod().
 * Signature contract (wallet-lib storage.getTxSignatures): async (tx, storage, pinCode) =>
 * { inputSignatures: [{inputIndex, addressIndex, signature, pubkey}], ncCallerSignature }.
 * The pinCode is a placeholder for passkey wallets and is ignored.
 */
export function makePasskeyTxSigner() {
  return async (tx, storage, _pinCode) => {
    // Reset the cancelled flag at the very start of every signing ceremony — BEFORE the
    // single-flight check — so a later consumePasskeySigningCancelled() reflects only this attempt.
    signingCancelled = false;
    // Fail before any prompt when the bundled wallet-lib can't service an external signer.
    if (typeof transactionUtils.signTxInputs !== 'function') {
      throw new PasskeySigningUnsupportedError();
    }
    let root = null;
    try {
      return await withPasskeyWords(async (words) => {
        // Derive the account root xpriv once; wallet-lib's signTxInputs derives the per-input
        // keys from the chain xprivs it requests through the resolver below.
        root = walletUtils.getXPrivKeyFromSeed(words, { networkName: NETWORK_MAINNET });

        // Delegate the input-signing loop to wallet-lib so input selection, shielded-spend
        // handling, the nano/OCB caller signature and encoding all live in one place and don't
        // drift as the lib evolves. The resolver returns the change-path xpriv for each chain
        // ('legacy' = m/44'/280'/0'/0, 'spend' = the shielded spend chain m/44'/280'/2'/0).
        return transactionUtils.signTxInputs(tx, storage, async (chain) => {
          // Shielded (spend) keys derive COMPLIANTLY (the lib derives the shielded chain with
          // deriveChild); legacy P2PKH keys stay non-compliant. Using the wrong one produces a
          // key that won't match the address the lib generated, so the signature fails on-chain.
          if (chain === 'spend') {
            const spendAcct = root.deriveChild(hathorConstants.SHIELDED_SPEND_ACCT_PATH);
            return spendAcct.deriveChild(0);
          }
          const legacyAcct = root.deriveNonCompliantChild(hathorConstants.P2PKH_ACCT_PATH);
          return legacyAcct.deriveNonCompliantChild(0);
        });
      }, { onCancel: () => { signingCancelled = true; } });
    } finally {
      // JS cannot zero string memory; dropping every reference as soon as possible is the
      // best available hygiene (same exposure window the lib has during getMainXPrivKey).
      root = null;
    }
  };
}

/**
 * Verify-only ceremony for the lock screen: asserts the passkey, checks it opens the loaded
 * wallet, and discards the derived material. Runs under the same single-flight guard as signing.
 * Resolves on success; throws PasskeyCancelledError / PasskeyXpubMismatchError / PasskeyBusyError.
 */
export function verifyPasskeyForUnlock() {
  return withPasskeyWords(async () => {});
}
