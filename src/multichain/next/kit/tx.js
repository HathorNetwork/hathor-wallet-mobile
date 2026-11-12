/**
 * Copyright (c) Hathor Labs and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import {
  parseTxV2,
  signingHashOf as signingHashOfV2,
  txIdOf as txIdOfV2,
  withInputSignatures,
} from './txV2';
import {
  V3_INDEX,
  parseTxV3,
  readTxV3,
  signingHashOfV3,
  txIdOfV3,
} from './txV3';

/**
 * The transactions this wallet signs: a payment in either wire format (a network accepts one, and
 * its first byte says which), and a token creation, mint or melt, which only v3 has. Every
 * function here takes what `parseTx` or `parseIssuanceTx` returns.
 */

export { withInputSignatures };

/**
 * A payment.
 *
 * @param {Uint8Array} bytes
 * @returns {Object} parseTxV2's fields, `format` ('v2' or 'v3') among them
 * @throws {Error} For any transaction this wallet does not sign
 */
export function parseTx(bytes) {
  return V3_INDEX[bytes[0]] ? parseTxV3(bytes) : parseTxV2(bytes);
}

/**
 * A token creation, mint or melt: v3, the index family.
 *
 * @param {Uint8Array} bytes
 * @returns {Object} readTxV3's fields: `kind`, `definition` (a creation's), `body` (a mint's or
 *   melt's), `outputs` with each one's `form`, `excess` (null when fully transparent), `authority`
 * @throws {Error} For anything else
 */
export function parseIssuanceTx(bytes) {
  if (!V3_INDEX[bytes[0]]) {
    throw new Error('Not a transaction this wallet signs.');
  }
  const tx = readTxV3(bytes);
  if (tx.kind === 'transfer') {
    throw new Error('Not a transaction this wallet signs.');
  }
  return tx;
}

/**
 * What every input signs, computed from the bytes.
 *
 * @param {Uint8Array} bytes
 * @param {Object} tx parseTx(bytes) or parseIssuanceTx(bytes)
 * @returns {Uint8Array} 32 bytes
 */
export function signingHashOf(bytes, tx) {
  return tx.format === 'v3' ? signingHashOfV3(bytes, tx) : signingHashOfV2(bytes, tx);
}

/**
 * The id of a signed transaction. A creation's token id is its transaction's id.
 *
 * @param {Uint8Array} bytes
 * @returns {Uint8Array} 32 bytes
 */
export function txIdOf(bytes) {
  if (V3_INDEX[bytes[0]]) {
    return txIdOfV3(bytes, readTxV3(bytes));
  }
  return txIdOfV2(bytes);
}

/**
 * The bytes with a mint's or melt's authority signature in its slot.
 *
 * @param {Uint8Array} bytes
 * @param {Object} tx parseIssuanceTx(bytes)
 * @param {Uint8Array} signature 64 bytes
 * @returns {Uint8Array}
 */
export function withAuthoritySignature(bytes, tx, signature) {
  if (!tx.authority) {
    throw new Error('Only a mint or a melt is signed by an authority.');
  }
  if (signature.length !== 64) {
    throw new Error('A signature is 64 bytes.');
  }
  const signed = Uint8Array.from(bytes);
  signed.set(signature, tx.authority.signatureOffset);
  return signed;
}
