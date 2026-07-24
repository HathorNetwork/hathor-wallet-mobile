/**
 * Copyright (c) Hathor Labs and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * Passkey (PRF) onboarding service.
 *
 * A WebAuthn passkey's PRF output is a 32-byte secret that is DETERMINISTIC for a given
 * credential + salt, never leaves the secure element, and is synced/backed-up by the platform
 * (iCloud Keychain / Google Password Manager). We use it as the BIP39 entropy for an otherwise
 * completely ordinary Hathor HD wallet: the user does Face ID, no 24 words are ever shown, and
 * "backup" becomes the passkey's own platform sync. Only the account xpub is persisted (never the
 * words or any private key); every signing operation re-runs the passkey ceremony to derive keys
 * in memory and immediately discards them (see passkeySigner.js).
 *
 * Native layer: react-native-passkey (PRF on iOS 18+ / Android Credential Manager).
 *
 * IMPORTANT — on-device prerequisites:
 *   - iOS: Associated Domains entitlement `webcredentials:<PASSKEY_RP_ID>` + a hosted
 *     https://<PASSKEY_RP_ID>/.well-known/apple-app-site-association. Without it, create/get fail.
 */

import { walletUtils } from '@hathor/wallet-lib';
import {
  PASSKEY_RP_ID,
  PASSKEY_RP_NAME,
} from '../constants';
import { logger } from '../logger';

const log = logger('passkey');

// PRF salt: a STABLE, PERMANENT input to the passkey PRF evaluation and therefore part of the
// seed-derivation input. Changing this value changes the derived seed of EVERY passkey wallet, so
// it must never be altered once the feature ships to users.
const PRF_SALT_STRING = 'hathor-passkey/prf/v1';
// Buffer is globally polyfilled in RN (see shim.js); avoid TextEncoder for reliability.
const PRF_SALT = new Uint8Array(Buffer.from(PRF_SALT_STRING, 'utf8'));

const toB64Url = (u8) => Buffer.from(u8)
  .toString('base64')
  .replace(/\+/g, '-')
  .replace(/\//g, '_')
  .replace(/=+$/, '');

const fromB64Url = (s) => new Uint8Array(
  Buffer.from(String(s).replace(/-/g, '+').replace(/_/g, '/'), 'base64')
);

// Random bytes for the NON-SECRET ceremony inputs only: the WebAuthn challenge (a per-ceremony
// nonce) and the random suffix of user.id (keeps credential ids unique). The wallet's actual
// entropy is the PRF output, which the authenticator computes inside its secure element and is
// never generated here.
const randomBytes = (n) => {
  const b = new Uint8Array(n);
  // react-native-get-random-values makes global.crypto.getRandomValues available.
  global.crypto.getRandomValues(b);
  return b;
};

// react-native-passkey is a NATIVE dependency. Lazy-require it so the JS bundle still builds for
// anyone who hasn't run `yarn && pod install` yet; the clear error only fires if passkey is used.
function getPasskey() {
  let mod;
  try {
    // eslint-disable-next-line global-require, import/no-unresolved
    mod = require('react-native-passkey');
  } catch (e) {
    // Keep the original error as the cause: a module that IS installed but throws during native
    // init would otherwise be misreported as "not installed" with its real stack lost.
    throw new Error(
      'react-native-passkey is not installed. Run `yarn && cd ios && pod install`.',
      { cause: e }
    );
  }
  // require() can succeed while the export is missing/renamed; assert it so the failure surfaces
  // here with a clear message instead of as a TypeError at the first Passkey.* call site.
  if (!mod?.Passkey) {
    throw new Error('react-native-passkey loaded but exposes no `Passkey` export (version mismatch?).');
  }
  return mod.Passkey;
}

/**
 * True when a passkey ceremony failed because the USER dismissed the OS sheet. react-native-passkey
 * normalizes a cancel to the stable code `error: 'UserCancelled'` on both platforms (its
 * handleNativeError maps the native code; anything unmapped becomes 'Native error'), so match that
 * structured code —
 * NOT a substring on the translatable message, which would false-positive on any error whose text
 * happens to contain "user cancel".
 */
export function isPasskeyCancel(e) {
  return e?.error === 'UserCancelled';
}

// user.id is capped at 64 bytes by WebAuthn; we spend 1 on the 0x00 separator and 8 on the
// random suffix, leaving 55 for the label.
const USER_ID_LABEL_MAX_BYTES = 55;

/**
 * Truncate a string to at most `maxBytes` UTF-8 bytes WITHOUT splitting a multi-byte code point.
 * Slicing by JS string length (`.slice`) counts UTF-16 units, so a CJK/emoji label can blow past
 * the byte budget; slicing raw bytes could split a character and yield a U+FFFD on decode, which
 * decodeUserIdLabel rejects. Iterate by code point (for..of) and stop before the budget overflows.
 */
function truncateUtf8(str, maxBytes) {
  let bytes = 0;
  let end = 0;
  for (const ch of str) {
    const chBytes = Buffer.byteLength(ch, 'utf8');
    if (bytes + chBytes > maxBytes) break;
    bytes += chBytes;
    end += ch.length;
  }
  return str.slice(0, end);
}

/**
 * user.id encoding: utf8(label) + 0x00 + 8 random bytes (≤64 bytes total, per WebAuthn).
 * The label part lets sign-in recover the wallet name from response.userHandle; the random
 * suffix keeps user.id UNIQUE per credential — authenticators REPLACE an existing passkey
 * when rp + user.id repeat, so two wallets with the same name must never share an id.
 */
function encodeUserId(label) {
  const labelBytes = Buffer.from(truncateUtf8(String(label), USER_ID_LABEL_MAX_BYTES), 'utf8');
  return toB64Url(Buffer.concat([labelBytes, Buffer.from([0]), Buffer.from(randomBytes(8))]));
}

/**
 * Reject strings that are not a human-typed label: decode artifacts (U+FFFD replacement
 * chars) and control characters mean the bytes were never text — e.g. passkeys registered
 * before labels were encoded in user.id carry 16 random bytes there. Returns null for those.
 */
export function sanitizePasskeyLabel(label) {
  if (!label || typeof label !== 'string') return null;
  const trimmed = label.trim();
  // eslint-disable-next-line no-control-regex
  if (!trimmed || /[\uFFFD\u0000-\u001F]/.test(trimmed)) return null;
  return trimmed;
}

/** Best-effort inverse of encodeUserId: label from a userHandle, or null. */
function decodeUserIdLabel(userHandle) {
  const bytes = toBytes(userHandle);
  if (!bytes || !bytes.length) return null;
  const buf = Buffer.from(bytes);
  const sep = buf.indexOf(0);
  const label = (sep >= 0 ? buf.subarray(0, sep) : buf).toString('utf8');
  return sanitizePasskeyLabel(label);
}

/** True if this device/build can produce a passkey PRF secret. */
export async function isPasskeySupported() {
  try {
    const Passkey = getPasskey();
    const r = Passkey.isSupported();
    return typeof r?.then === 'function' ? await r : !!r;
  } catch (e) {
    // This gate decides whether the feature is offered at all, so a broken pod/native link would
    // otherwise be indistinguishable from a genuinely-unsupported device. Log before swallowing.
    log.error('isPasskeySupported() failed; treating passkeys as unsupported', e);
    return false;
  }
}

/** Coerce a binary value (base64url string, byte array, or RN Uint8Array-as-object) to bytes. */
function toBytes(v) {
  if (v == null) return undefined;
  if (v instanceof Uint8Array) return v;
  if (typeof v === 'string') return fromB64Url(v);
  if (Array.isArray(v)) return new Uint8Array(v);
  if (typeof v === 'object') {
    // RN serializes a Uint8Array across the bridge as { "0": b, "1": b, ... }.
    const keys = Object.keys(v).filter((k) => /^\d+$/.test(k)).sort((a, b) => Number(a) - Number(b));
    if (keys.length) return new Uint8Array(keys.map((k) => v[k]));
  }
  return undefined;
}

/** Dig the PRF `first` result out of a react-native-passkey result, tolerant of its shape. */
function digPrfFirst(result) {
  const ext = result?.clientExtensionResults ?? result?.response?.clientExtensionResults;
  const raw = ext?.prf?.results?.first;
  const bytes = toBytes(raw);
  // A PRF result that IS present but that toBytes can't decode is a parsing regression (a
  // react-native-passkey shape change), NOT an unsupported device — surface it distinctly so
  // wordsFromPrf's "needs iOS 18+" message doesn't misattribute it to the OS version.
  if (raw != null && !bytes) {
    const shape = typeof raw === 'object' ? `object keys=[${Object.keys(raw).join(',')}]` : typeof raw;
    throw new Error(`Received a PRF result but could not decode it (unexpected shape: ${shape}).`);
  }
  return bytes;
}

/**
 * Register a passkey with PRF ENABLED (hmac-secret), but do NOT evaluate the salt here.
 * iOS enables PRF at registration yet returns the secret only at ASSERTION, and passing salt
 * inputs at registration is the least-supported path (a likely source of a generic native
 * failure). We evaluate the salt in getPrfViaAssertion() instead — the PRF output is deterministic
 * per (credential, salt), so the derived seed is identical whichever call evaluates it.
 */
async function registerPasskey(userName) {
  const Passkey = getPasskey();
  const result = await Passkey.create({
    challenge: toB64Url(randomBytes(32)),
    rp: { id: PASSKEY_RP_ID, name: PASSKEY_RP_NAME },
    user: { id: encodeUserId(userName), name: userName, displayName: userName },
    pubKeyCredParams: [{ type: 'public-key', alg: -7 }], // ES256 / P-256 — the only curve passkeys do
    authenticatorSelection: { residentKey: 'required', userVerification: 'preferred' },
    extensions: { prf: {} }, // enable PRF / check support; evaluate at assertion
  });
  return result?.id ?? result?.rawId; // credentialId
}

/**
 * Assert with the passkey to obtain the PRF secret (many platforms only return PRF on get()).
 * Also surfaces the userHandle (= user.id) when the platform returns it, so callers can
 * recover the wallet label encoded at registration. userHandle is optional on both platforms.
 */
async function getPrfViaAssertion(credentialId) {
  const Passkey = getPasskey();
  const result = await Passkey.get({
    challenge: toB64Url(randomBytes(32)),
    rpId: PASSKEY_RP_ID,
    userVerification: 'preferred',
    allowCredentials: credentialId ? [{ type: 'public-key', id: credentialId }] : undefined,
    // iOS wants binary PRF inputs as a Uint8Array (it arrives as a Dictionary and is decoded
    // byte-by-byte); a base64url string throws DecodingError.typeMismatch. Pass the raw bytes.
    extensions: { prf: { eval: { first: PRF_SALT } } },
  });
  return {
    prf: digPrfFirst(result),
    userHandle: result?.response?.userHandle ?? result?.userHandle,
    credentialId: result?.id ?? result?.rawId ?? null,
  };
}

/** 32-byte PRF secret -> { words } (a 24-word BIP39 phrase). Same secret => same wallet. */
function wordsFromPrf(prf32) {
  if (!prf32 || prf32.length !== 32) {
    throw new Error(
      'Could not obtain a 32-byte PRF secret from the passkey. PRF may be unsupported on this '
        + 'device (needs iOS 18+, or Android with Google Password Manager passkeys).'
    );
  }
  // 32 bytes of entropy -> exactly 24 BIP39 words. wallet-lib's generateWalletWords passes the
  // Buffer straight to bitcore-mnemonic as ENTROPY, so this is deterministic and matches the
  // seed handling used everywhere else in the wallet.
  return { words: walletUtils.generateWalletWords(Buffer.from(prf32)) };
}

/**
 * CREATE a brand-new passkey and derive a fresh wallet seed from its PRF secret.
 * Use for first-time onboarding — this mints a NEW passkey (and thus a NEW wallet) every call.
 *
 * @param {string} userName label shown by the OS passkey UI
 * @returns {Promise<{ words: string, label: string, credentialId: string|null }>}
 */
export async function createWalletWordsFromPasskey(userName = 'Hathor Wallet') {
  const credentialId = await registerPasskey(userName); // enables PRF on the new passkey
  const { prf } = await getPrfViaAssertion(credentialId); // Face ID again to evaluate PRF
  return { ...wordsFromPrf(prf), label: userName, credentialId: credentialId ?? null };
}

/**
 * SIGN IN with an EXISTING passkey and re-derive the SAME wallet seed from its PRF secret.
 *
 * Uses a DISCOVERABLE assertion (no allowCredentials), so iOS/Android lists the user's passkeys
 * for this domain to choose from. Because platform passkeys (and their PRF output) sync via iCloud
 * Keychain / Google Password Manager, this returns the identical seed after a wallet reset, an app
 * reinstall, or on a different device signed into the same account — that's the recovery story.
 *
 * The label is recovered from the assertion's userHandle when the platform returns it
 * (encoded at registration by encodeUserId); null when unavailable.
 *
 * When the wallet already knows its credential (walletMeta.credentialId), pass it as
 * `options.credentialId`: the OS then skips the passkey picker and prompts biometrics for
 * that credential directly, making the wrong-passkey path impossible in normal use.
 *
 * @param {{ credentialId?: string }} [options]
 * @returns {Promise<{ words: string, label: string|null, credentialId: string|null }>}
 */
export async function signInWalletWordsFromPasskey(options = {}) {
  // Without options.credentialId this is a DISCOVERABLE assertion (OS lists all passkeys).
  const { prf, userHandle, credentialId } = await getPrfViaAssertion(options.credentialId);
  return {
    ...wordsFromPrf(prf),
    label: decodeUserIdLabel(userHandle),
    credentialId,
  };
}
