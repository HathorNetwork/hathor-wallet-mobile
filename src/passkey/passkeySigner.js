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
 * verifies it belongs to THIS wallet (derived xpub === stored xpub), signs every input the same
 * way the lib's own getSignatureForTx does, and discards all key material before returning.
 * Register it with wallet.setExternalTxSigningMethod() BEFORE wallet.start().
 */

import { t } from 'ttag';
import { constants as hathorConstants, transactionUtils, walletUtils } from '@hathor/wallet-lib';
import { NETWORK_MAINNET } from '../constants';
import { STORE } from '../store';
import {
  signInWalletWordsFromPasskey,
  isPasskeyCancel,
  sanitizePasskeyLabel,
} from './passkeyService';

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
 * Build the EcdsaTxSign callback for wallet.setExternalTxSigningMethod().
 * Signature contract (wallet-lib storage.getTxSignatures): async (tx, storage, pinCode) =>
 * { inputSignatures: [{inputIndex, addressIndex, signature, pubkey}], ncCallerSignature }.
 * The pinCode is a placeholder for passkey wallets and is ignored.
 */
export function makePasskeyTxSigner() {
  return async function passkeyTxSigner(tx, storage, _pinCode) {
    if (signingInFlight) {
      throw new PasskeyBusyError();
    }
    signingInFlight = true;
    signingCancelled = false;
    let root = null;
    let changeKey = null;
    try {
      const meta = STORE.getWalletMeta();
      let words;
      let credentialId;
      try {
        // Passing the stored credentialId skips the OS passkey picker and prompts
        // biometrics for THIS wallet's credential directly.
        ({ words, credentialId } = await signInWalletWordsFromPasskey({
          credentialId: meta?.credentialId,
        }));
      } catch (e) {
        if (isPasskeyCancel(e)) {
          signingCancelled = true;
          throw new PasskeyCancelledError();
        }
        throw e;
      }

      if (!meta?.xpub || derivePasskeyXpub(words) !== meta.xpub) {
        throw new PasskeyXpubMismatchError(meta?.passkeyLabel);
      }

      // Wallets signed in before credentialId was captured (or on another device) learn it
      // here, so the next ceremony can skip the picker too.
      if (credentialId && credentialId !== meta.credentialId) {
        STORE.updateWalletMeta({ credentialId });
      }

      // Same derivation the lib uses internally: the "main key" is the CHANGE-path xpriv
      // (m/44'/280'/0'/0) and each input key is a single non-hardened child of it.
      root = walletUtils.getXPrivKeyFromSeed(words, { networkName: NETWORK_MAINNET });
      words = null;
      changeKey = root
        .deriveNonCompliantChild(hathorConstants.P2PKH_ACCT_PATH)
        .deriveNonCompliantChild(0);

      if (tx.version === hathorConstants.ON_CHAIN_BLUEPRINTS_VERSION) {
        // No OCB flow exists on mobile; failing clearly beats returning an unsigned header.
        throw new Error(t`On-chain blueprints are not supported for passkey wallets.`);
      }

      const dataToSignHash = tx.getDataToSignHash();
      const inputSignatures = [];
      let ncCallerSignature = null;

      const spentTxsIter = storage.getSpentTxs(tx.inputs);
      /* eslint-disable no-await-in-loop */
      for await (const { tx: spentTx, input, index: inputIndex } of spentTxsIter) {
        // Skip inputs that are already signed or don't belong to this wallet — mirrors
        // the lib's getSignatureForTx.
        if (!input.data) {
          const spentOut = spentTx.outputs[input.index];
          const addressInfo = spentOut.decoded.address
            ? await storage.getAddressInfo(spentOut.decoded.address)
            : null;
          if (addressInfo) {
            const key = changeKey.deriveNonCompliantChild(addressInfo.bip32AddressIndex);
            inputSignatures.push({
              inputIndex,
              addressIndex: addressInfo.bip32AddressIndex,
              signature: transactionUtils.getSignature(dataToSignHash, key.privateKey),
              pubkey: key.publicKey.toDER(),
            });
          }
        }
      }
      /* eslint-enable no-await-in-loop */

      if (tx.isNanoContract()) {
        const caller = transactionUtils.getNanoContractCaller(tx);
        if (caller) {
          const addressInfo = await storage.getAddressInfo(caller.base58);
          if (addressInfo) {
            const key = changeKey.deriveNonCompliantChild(addressInfo.bip32AddressIndex);
            const signature = transactionUtils.getSignature(dataToSignHash, key.privateKey);
            ncCallerSignature = transactionUtils.createInputData(signature, key.publicKey.toDER());
          }
        }
      }

      return { inputSignatures, ncCallerSignature };
    } finally {
      // JS cannot zero string memory; dropping every reference as soon as possible is the
      // best available hygiene (same exposure window the lib has during getMainXPrivKey).
      root = null;
      changeKey = null;
      signingInFlight = false;
    }
  };
}

/**
 * Verify-only ceremony for the lock screen: asserts the passkey, checks it opens the loaded
 * wallet, and discards the derived material. Resolves on success; throws
 * PasskeyCancelledError / PasskeyXpubMismatchError otherwise.
 */
export async function verifyPasskeyForUnlock() {
  const meta = STORE.getWalletMeta();
  let words = null;
  let credentialId = null;
  try {
    ({ words, credentialId } = await signInWalletWordsFromPasskey({
      credentialId: meta?.credentialId,
    }));
  } catch (e) {
    if (isPasskeyCancel(e)) {
      throw new PasskeyCancelledError();
    }
    throw e;
  }
  try {
    if (!meta?.xpub || derivePasskeyXpub(words) !== meta.xpub) {
      throw new PasskeyXpubMismatchError(meta?.passkeyLabel);
    }
    if (credentialId && credentialId !== meta.credentialId) {
      STORE.updateWalletMeta({ credentialId });
    }
  } finally {
    words = null;
  }
}
