/**
 * Copyright (c) Hathor Labs and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/* eslint-disable no-bitwise -- bech32m is defined in bit operations */

import { RistrettoPoint } from '@noble/curves/ed25519';
import { hexToBytes } from './scalar';

/**
 * The Hathor Next address, copied from the Hathor Next wallets' codec
 * (`clients/wallet-sdk/packages/core-api/src/address.ts`, itself a port of
 * `samba_crypto::address`) and held to it by the shared vectors.
 *
 * v2, the only form emitted: bech32m with the human-readable part `samba`, one version symbol
 * (2, written `z`), the 64 bytes `A ‖ B` and a checksum. 116 characters, always `samba1z…`.
 * Lowercase is canonical, all-uppercase (a QR code's alphanumeric mode) is accepted, mixed case
 * is refused. The legacy `samba:` + 128 hex is accepted on input and never emitted.
 *
 * Unlike the TypeScript codec, decodeAddressKeys also checks that both keys are curve points,
 * the check the Rust codec makes (`not-a-point`).
 */

export const ADDRESS_HRP = 'samba';
export const ADDRESS_VERSION = 2;
export const ADDRESS_V2_LENGTH = 116;
export const ADDRESS_LEGACY_LENGTH = 134;

const LEGACY_PREFIX = 'samba:';
const V2_PREFIX = 'samba1';
const CHARSET = 'qpzry9x8gf2tvdw0s3jn54khce6mua7l';
const BECH32M_CONST = 0x2bc830a3;
const GEN = [0x3b6a57b2, 0x26508e6d, 0x1ea119fa, 0x3d4233dd, 0x2a1462b3];

/** Why a string is not an address. `code` is the Rust codec's `AddressError::code()`. */
export class AddressError extends Error {
  /**
   * @param {string} code
   * @param {string} message The Rust codec's text
   * @param {{ position?: number, version?: number }} [extra]
   */
  constructor(code, message, extra = {}) {
    super(message);
    this.name = 'AddressError';
    this.code = code;
    if (extra.position !== undefined) this.position = extra.position;
    if (extra.version !== undefined) this.version = extra.version;
  }
}

function polymod(values) {
  let chk = 1;
  for (const v of values) {
    const top = chk >>> 25;
    chk = (((chk & 0x1ffffff) << 5) ^ v) >>> 0;
    for (let i = 0; i < 5; i += 1) {
      if ((top >>> i) & 1) chk = (chk ^ GEN[i]) >>> 0;
    }
  }
  return chk;
}

function hrpExpand(hrp) {
  const codes = [...hrp].map((c) => c.charCodeAt(0));
  return [...codes.map((c) => c >>> 5), 0, ...codes.map((c) => c & 31)];
}

function checksum(data) {
  const values = [...hrpExpand(ADDRESS_HRP), ...data, 0, 0, 0, 0, 0, 0];
  const pm = (polymod(values) ^ BECH32M_CONST) >>> 0;
  return [0, 1, 2, 3, 4, 5].map((i) => (pm >>> (5 * (5 - i))) & 31);
}

// ASCII-only, as Rust's `to_ascii_lowercase`: `toLowerCase()` would fold a KELVIN SIGN to `k`,
// which is in the alphabet, and accept a string the Rust codec refuses.
function asciiLower(s) {
  return s.replace(/[A-Z]/g, (c) => String.fromCharCode(c.charCodeAt(0) + 32));
}

// Rust's `{:?}` of a char, for the common cases.
function quoted(c) {
  return c === "'" ? "'\\''" : `'${c}'`;
}

function hexBytes(hex, what) {
  if (!/^[0-9a-fA-F]{64}$/.test(hex)) throw new TypeError(`${what} must be 64 hex characters`);
  const out = [];
  for (let i = 0; i < 64; i += 2) out.push(parseInt(hex.slice(i, i + 2), 16));
  return out;
}

function toHex(bytes) {
  return bytes.map((b) => b.toString(16).padStart(2, '0')).join('');
}

/**
 * The v2 address of `(A, B)`, from their compressed encodings in hex.
 *
 * @param {string} viewHex
 * @param {string} spendHex
 * @returns {string}
 */
export function encodeAddress(viewHex, spendHex) {
  const bytes = [...hexBytes(viewHex, 'view key'), ...hexBytes(spendHex, 'spend key')];
  const data = [ADDRESS_VERSION];
  let acc = 0;
  let bits = 0;
  for (const b of bytes) {
    acc = ((acc << 8) | b) & 0xfff;
    bits += 8;
    while (bits >= 5) {
      bits -= 5;
      data.push((acc >>> bits) & 31);
    }
  }
  if (bits > 0) data.push((acc << (5 - bits)) & 31);
  return V2_PREFIX + [...data, ...checksum(data)].map((d) => CHARSET[d]).join('');
}

function decodeLegacy(s) {
  const rest = s.slice(LEGACY_PREFIX.length);
  // `samba:samba1…`: a v2 address behind a URI scheme it does not take.
  if (asciiLower(rest.slice(0, V2_PREFIX.length)) === V2_PREFIX) {
    throw new AddressError('wrong-prefix', 'wrong prefix: an address starts with `samba1`');
  }
  const chars = [...s];
  if (chars.length !== ADDRESS_LEGACY_LENGTH) {
    throw new AddressError(
      'wrong-length',
      `wrong length: ${chars.length} characters, a legacy address has ${ADDRESS_LEGACY_LENGTH}`,
    );
  }
  const body = chars.slice(LEGACY_PREFIX.length);
  const bad = body.findIndex((c) => !/^[0-9a-fA-F]$/.test(c));
  if (bad >= 0) {
    const position = LEGACY_PREFIX.length + bad;
    throw new AddressError(
      'bad-character',
      `character ${quoted(body[bad])} at position ${position} is not a hex digit`,
      { position },
    );
  }
  const hex = asciiLower(body.join(''));
  return { form: 'legacy', view: hex.slice(0, 64), spend: hex.slice(64) };
}

/**
 * Reads an address's two keys, either form. The checksum is checked before the version is read,
 * so `unknown-version` only ever names a correctly typed string.
 *
 * @param {string} s
 * @returns {{ form: 'v2'|'legacy', view: string, spend: string }} The keys in lowercase hex
 * @throws {AddressError}
 */
export function decodeAddress(s) {
  if (asciiLower(s.slice(0, LEGACY_PREFIX.length)) === LEGACY_PREFIX) return decodeLegacy(s);
  if (/[a-z]/.test(s) && /[A-Z]/.test(s)) {
    throw new AddressError('mixed-case', 'mixed case: an address is all lowercase or all uppercase');
  }
  const lower = asciiLower(s);
  if (!lower.startsWith(V2_PREFIX)) {
    throw new AddressError('wrong-prefix', 'wrong prefix: an address starts with `samba1`');
  }
  const chars = [...s];
  if (chars.length !== ADDRESS_V2_LENGTH) {
    throw new AddressError(
      'wrong-length',
      `wrong length: ${chars.length} characters, a v2 address has ${ADDRESS_V2_LENGTH}`,
    );
  }
  const data = [];
  for (let i = V2_PREFIX.length; i < chars.length; i += 1) {
    const c = chars[i];
    const v = c.length === 1 ? CHARSET.indexOf(asciiLower(c)) : -1;
    if (v < 0) {
      throw new AddressError(
        'bad-character',
        `character ${quoted(c)} at position ${i} is not in the bech32 alphabet`,
        { position: i },
      );
    }
    data.push(v);
  }
  if (polymod([...hrpExpand(ADDRESS_HRP), ...data]) !== BECH32M_CONST) {
    throw new AddressError('bad-checksum', 'bad checksum: the address has a typo');
  }
  const version = data[0];
  if (version !== ADDRESS_VERSION) {
    throw new AddressError(
      'unknown-version',
      `unknown address version ${version}: this build reads version ${ADDRESS_VERSION}`,
      { version },
    );
  }
  const bytes = [];
  let acc = 0;
  let bits = 0;
  for (const v of data.slice(1, data.length - 6)) {
    acc = ((acc << 5) | v) & 0xfff;
    bits += 5;
    if (bits >= 8) {
      bits -= 8;
      bytes.push((acc >>> bits) & 0xff);
    }
  }
  if ((acc & ((1 << bits) - 1)) !== 0) {
    throw new AddressError(
      'non-zero-padding',
      'non-canonical address: the padding bits after the spend key are not zero',
    );
  }
  return { form: 'v2', view: toHex(bytes.slice(0, 32)), spend: toHex(bytes.slice(32)) };
}

/**
 * Reads an address's two keys and checks that both are curve points, so nothing can pay a key
 * no one can spend from. Refuses with `not-a-point`, as the Rust codec does.
 *
 * @param {string} s
 * @returns {{ form: 'v2'|'legacy', view: Uint8Array, spend: Uint8Array }}
 * @throws {AddressError}
 */
export function decodeAddressKeys(s) {
  const { form, view, spend } = decodeAddress(s);
  const keys = { form, view: hexToBytes(view), spend: hexToBytes(spend) };
  for (const key of [keys.view, keys.spend]) {
    try {
      RistrettoPoint.fromHex(key);
    } catch (e) {
      throw new AddressError('not-a-point', 'not an address: a key is not a curve point');
    }
  }
  return keys;
}
