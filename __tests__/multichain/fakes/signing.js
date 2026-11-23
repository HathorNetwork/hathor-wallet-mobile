/**
 * Copyright (c) Hathor Labs and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { EXCESS_DOMAIN } from '../../../src/multichain/next/kit/inputSig';
import { hashToScalar } from '../../../src/multichain/next/kit/hash';
import { expectedOutput } from '../../../src/multichain/next/kit/opening';
import { parseTx, signingHashOf } from '../../../src/multichain/next/kit/tx';
import { publicKeyOf } from '../../../src/multichain/next/kit/keys';
import {
  bigintToBytesLE,
  bytesToHex,
  concatBytes,
  hexToBytes,
  modOrder,
  scalarFromCanonical,
} from '../../../src/multichain/next/kit/scalar';

/**
 * What the tests of Hathor Next signing share: a refusal caught, a storage, the inputs of a vector
 * as an honest backend lists them, transactions as a dishonest backend could build them, and the
 * refusals a client or a bridge logged.
 */

/**
 * @param {Function} fn
 * @returns {Error|null} What `fn` throws, or null when it returns
 */
export const refusal = (fn) => {
  try {
    fn();
  } catch (e) {
    return e;
  }
  return null;
};

/**
 * A storage as the app's, in memory: each value kept as JSON text.
 *
 * @param {{ initial?: Object, failWrites?: boolean }} [options] `initial` maps keys to JSON text
 */
export function memoryStorage({ initial = {}, failWrites = false } = {}) {
  const data = { ...initial };
  return {
    data,
    getItem: (key) => (key in data ? JSON.parse(data[key]) : null),
    setItemAsync: async (key, value) => {
      if (failWrites) throw new Error('disk full');
      data[key] = JSON.stringify(value);
    },
    removeItem: (key) => { delete data[key]; },
  };
}

/** A payment vector's inputs as an honest backend lists them: with the output each one spends. */
export const inputsOf = (vector) => {
  const tx = parseTx(hexToBytes(vector.unsigned_tx));
  return vector.inputs.map((input, i) => ({
    ...input,
    global_index: Number(tx.inputs[i].outputIndex),
  }));
};

// The key a test signs a forged transaction's excess with. The app checks that signature, not
// that the amounts balance (the network does), so a forged transaction fails only the check
// under test.
export const FORGER = 777n;
export const FORGER_KEY = publicKeyOf(FORGER);

/**
 * @param {Uint8Array} msg A signing hash
 * @returns {Uint8Array} FORGER's excess signature over it, R ‖ s
 */
export function forgerSignature(msg) {
  const k = 4242n;
  const e = hashToScalar(EXCESS_DOMAIN, [FORGER_KEY, publicKeyOf(k), msg]);
  return concatBytes(publicKeyOf(k), bigintToBytesLE(modOrder(k + e * FORGER)));
}

/**
 * A payment vector's bytes changed by `change`, with FORGER's excess, signed over the new bytes.
 *
 * @param {Object} vector
 * @param {function(Uint8Array): Uint8Array} change
 * @returns {string} Hex
 */
export function forge(vector, change) {
  const bytes = change(hexToBytes(vector.unsigned_tx));
  bytes.set(FORGER_KEY, parseTx(bytes).excess.signatureOffset - 32);
  const tx = parseTx(bytes);
  bytes.set(forgerSignature(signingHashOf(bytes, tx)), tx.excess.signatureOffset);
  return bytesToHex(bytes);
}

/**
 * Output `j` of a v2 transaction, of either width, rewritten to pay `amount` of `token` to
 * `address`, as the vector's sender would have written it. The layout is kit/txV2.js's.
 *
 * @param {Object} vector
 * @param {number} j
 * @param {{ address: string, token: string, amount: string|bigint }} paid
 * @returns {function(Uint8Array): Uint8Array} A change for forge()
 */
export function payingTo(vector, j, { address, token, amount }) {
  return (bytes) => {
    const tx = parseTx(bytes);
    const u128 = tx.width === 'u128';
    const points = u128 ? 5 : 4;
    const linkLen = u128 ? 256 : 160;
    const memoLen = u128 ? 16 : 8;
    const surjectionLen = 36 + 32 * tx.nIn;
    const outputLen = 32 * points + linkLen + surjectionLen + 1 + memoLen;
    const inputsOff = 36 + (u128 ? 16 : 8) + 1 + 32 * tx.table.length;
    const o = inputsOff + tx.nIn * (8 + 64) + j * outputLen;
    const tagOff = o + 32 * points + linkLen + surjectionLen;
    const r = scalarFromCanonical(hexToBytes(vector.sender_opening));
    const want = expectedOutput(r, address, hexToBytes(token), BigInt(amount), j, memoLen);
    bytes.set(want.oneTimeKey, o);
    bytes.set(want.assetTag, o + 32);
    bytes.set(want.commitment, o + 64);
    bytes.set(Uint8Array.of(want.viewTag), tagOff);
    bytes.set(want.memo, tagOff + 1);
    return bytes;
  };
}

/**
 * The refusals a module logged, in its own words: what follows `prefix` in each line it gave
 * console.error (logger.js writes `[scope] message`). A client or a bridge throws one error code
 * for every refusal; its log says which check refused.
 *
 * @param {Object} spy jest.spyOn(console, 'error')
 * @param {string} scope The module's logger scope
 * @param {string} prefix What the module writes before the refusal's words
 * @returns {string[]}
 */
export const loggedRefusals = (spy, scope, prefix) => spy.mock.calls
  .map(([line]) => String(line))
  .filter((line) => line.startsWith(`[${scope}] ${prefix}`))
  .map((line) => line.slice(`[${scope}] ${prefix}`.length));
