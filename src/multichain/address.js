/**
 * Copyright (c) Hathor Labs and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { t } from 'ttag';
import { validateAddress } from '../utils';
import { CHAIN } from './chains';

/**
 * The shapes of a Hathor Next address, from the Hathor Next wallet (hathor-next-wallet-mobile's
 * src/lib/format.ts), which is deliberately the only place there that decides what counts as one:
 * - live: `samba:` and 128 hex characters (the view and spend public keys). The prefix is part of
 *   the address and is lowercase: `SAMBA:` is refused, as Hathor Next's core refuses it;
 * - placeholder: `smb1…`, the bech32-like form the Hathor Next fixtures use.
 * The real encoding (bech32m) is still open; when it lands, these change and nothing else does.
 */
const NEXT_ADDRESS_RE = /^samba:[0-9a-fA-F]{128}$/;
const NEXT_PLACEHOLDER_ADDRESS_RE = /^smb1[02-9ac-hj-np-z]{40,}$/i;
// A live address followed by a payment request's query (`?amount=…`), or nothing.
const NEXT_URI_RE = /^(samba:[0-9a-fA-F]{128})(\?.*)?$/;

/**
 * Whether a text is a Hathor Next address.
 *
 * @param {string|null|undefined} text
 * @returns {boolean}
 */
export function isNextAddress(text) {
  const value = (text ?? '').trim();
  return NEXT_ADDRESS_RE.test(value) || NEXT_PLACEHOLDER_ADDRESS_RE.test(value);
}

/**
 * What a scanned QR code holds for Hathor Next: `{ address }` for an address alone, `{ error }`
 * for a payment request on one (`samba:…?amount=…`), or null when it holds no Hathor Next
 * address. A payment request is refused, as Hathor Network's scanner refuses one: taking only its
 * address would drop the amount and the token it asks for without a word.
 *
 * @param {string|null|undefined} data
 * @returns {{ address: string }|{ error: string }|null}
 */
export function parseNextQrCode(data) {
  const value = (data ?? '').trim();
  const match = NEXT_URI_RE.exec(value);
  if (match) {
    // A bare `?` asks for nothing.
    return match[2] && match[2] !== '?' ? { error: paymentRequestText() } : { address: match[1] };
  }
  return NEXT_PLACEHOLDER_ADDRESS_RE.test(value) ? { address: value } : null;
}

/** Why a payment request's QR code is refused. */
export const paymentRequestText = () => t`Payment request QR codes are not supported. Please use a simple address QR code.`;

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
