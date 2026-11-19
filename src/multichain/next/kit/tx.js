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
import { V3_INDEX, parseTxV3, signingHashOfV3, txIdOfV3 } from './txV3';

/**
 * The transfer this wallet signs, in either wire format: a network accepts one, and its first
 * byte says which. Every function here takes what `parseTx` returns.
 */

export { withInputSignatures };

/**
 * @param {Uint8Array} bytes
 * @returns {Object} parseTxV2's fields, `format` ('v2' or 'v3') among them
 * @throws {Error} For any transaction this wallet does not sign
 */
export function parseTx(bytes) {
  return V3_INDEX[bytes[0]] ? parseTxV3(bytes) : parseTxV2(bytes);
}

/**
 * What every input signs, computed from the bytes.
 *
 * @param {Uint8Array} bytes
 * @param {Object} tx parseTx(bytes)
 * @returns {Uint8Array} 32 bytes
 */
export function signingHashOf(bytes, tx) {
  return tx.format === 'v3' ? signingHashOfV3(bytes, tx) : signingHashOfV2(bytes, tx);
}

/**
 * The outputs a transaction spends, by global index (decimal strings), from its parsed fields.
 * The sign-once ledger names an input by this, never by its one-time key: a declared output pays
 * the recipient's spend key itself, so all of one wallet's declared coins share one key.
 *
 * @param {Object} tx What parseTx returns
 * @returns {string[]}
 */
export function spentOutputs(tx) {
  return tx.inputs.map((input) => input.outputIndex.toString());
}

/**
 * The outputs a saved transaction spends, read from its bytes, signed or not.
 *
 * @param {Uint8Array} bytes
 * @returns {string[]}
 * @throws {Error} When the bytes don't read
 */
export function spentOutputsOfBytes(bytes) {
  return spentOutputs(parseTx(bytes));
}

/**
 * The id of a signed transaction.
 *
 * @param {Uint8Array} bytes
 * @returns {Uint8Array} 32 bytes
 */
export function txIdOf(bytes) {
  const tx = parseTx(bytes);
  return tx.format === 'v3' ? txIdOfV3(bytes, tx) : txIdOfV2(bytes);
}
