/**
 * Copyright (c) Hathor Labs and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { t } from 'ttag';
import { validateAddress } from '../utils';
import { CHAIN } from './chains';
import { decodeAddressKeys, encodeAddress } from './next/kit/address';
import { bytesToHex } from './next/kit/scalar';

/**
 * A Hathor Next address is read by the kit's codec (next/kit/address.js), a copy of Hathor Next's
 * own: the bech32m form `samba1z…` (116 characters, all lowercase or all uppercase), and the
 * legacy `samba:` + 128 hex on input. Both keys must be curve points. The codec is the only place
 * that decides what counts as an address.
 */
// A payment request: an address, optionally behind the `samba:` scheme, and an optional query.
const SCHEME_RE = /^samba:(\/\/)?/i;

/**
 * The keys of a Hathor Next address, or null when the text isn't one.
 *
 * @param {string|null|undefined} text
 * @returns {{ view: Uint8Array, spend: Uint8Array }|null}
 */
export function nextAddressKeys(text) {
  const value = (text ?? '').trim();
  if (!value) {
    return null;
  }
  try {
    const { view, spend } = decodeAddressKeys(value);
    return { view, spend };
  } catch (e) {
    return null;
  }
}

/**
 * Whether a text is a Hathor Next address.
 *
 * @param {string|null|undefined} text
 * @returns {boolean}
 */
export function isNextAddress(text) {
  return nextAddressKeys(text) !== null;
}

/**
 * The canonical form of a Hathor Next address: the lowercase `samba1z…` of its keys, whichever
 * form was typed or scanned.
 *
 * @param {string|null|undefined} text
 * @returns {string|null} null when the text isn't an address
 */
export function normalizeNextAddress(text) {
  const keys = nextAddressKeys(text);
  return keys ? encodeAddress(bytesToHex(keys.view), bytesToHex(keys.spend)) : null;
}

/**
 * Whether two texts are the same Hathor Next address: the same keys, in any form or case.
 *
 * @param {string|null|undefined} a
 * @param {string|null|undefined} b
 * @returns {boolean}
 */
export function sameNextAddress(a, b) {
  const one = normalizeNextAddress(a);
  return one !== null && one === normalizeNextAddress(b);
}

/**
 * The Hathor Next address a scanned QR code holds: the address alone, or a payment request on it
 * (`samba:<address>?amount=…`). The amount and token of a payment request are dropped, as Hathor
 * Network's scanner drops them.
 *
 * @param {string|null|undefined} data
 * @returns {string|null} The address in its canonical form, or null when the QR code holds none
 */
export function parseNextQrCode(data) {
  const value = (data ?? '').trim();
  const [head] = value.split('?');
  // The legacy form starts with the scheme's own letters: it is an address as it stands.
  const direct = normalizeNextAddress(head);
  if (direct) {
    return direct;
  }
  return SCHEME_RE.test(head) ? normalizeNextAddress(head.replace(SCHEME_RE, '')) : null;
}

/**
 * Whether a text is a valid Hathor Network address of the network the wallet runs on.
 *
 * @param {string|null|undefined} text
 * @param {Object} network wallet-lib Network
 * @returns {boolean}
 */
export function isHathorAddress(text, network) {
  if (!text) {
    return false;
  }
  return validateAddress(text.trim(), network, { allowShielded: true }).isValid;
}

/**
 * The chain an address belongs to: Hathor Network's (of the network the wallet runs on) or Hathor
 * Next's. The two formats can't be confused, so the address alone picks the chain a send is on.
 *
 * @param {string|null|undefined} address
 * @param {Object} network wallet-lib Network
 * @param {Object} [options]
 * @param {boolean} [options.allowShielded] Whether a shielded Hathor Network address counts
 * @returns {string|null} One of CHAIN, or null when it is neither
 */
export function addressChain(address, network, { allowShielded = true } = {}) {
  const value = (address ?? '').trim();
  if (!value) {
    return null;
  }
  if (isNextAddress(value)) {
    return CHAIN.HATHOR_NEXT;
  }
  return validateAddress(value, network, { allowShielded }).isValid ? CHAIN.HATHOR : null;
}

/**
 * Validates the address a transfer between chains goes to: an address of the destination chain.
 * An address of the other chain gets words of its own, since it looks right and isn't.
 *
 * @param {string|null|undefined} address
 * @param {Object} network wallet-lib Network
 * @param {string} [toChain] One of CHAIN: the destination
 * @returns {{ isValid: boolean, message?: string }}
 */
export function validateTransferAddress(address, network, toChain = CHAIN.HATHOR_NEXT) {
  const chain = addressChain(address, network);
  if (chain === toChain) {
    return { isValid: true };
  }
  if (chain === CHAIN.HATHOR) {
    return {
      isValid: false,
      message: t`This is a Hathor Network address. Enter a Hathor Next address.`,
    };
  }
  if (chain === CHAIN.HATHOR_NEXT) {
    return {
      isValid: false,
      message: t`This is a Hathor Next address. Enter a Hathor Network address.`,
    };
  }
  return { isValid: false, message: t`Invalid address` };
}
