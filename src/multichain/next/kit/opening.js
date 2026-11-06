/**
 * Copyright (c) Hathor Labs and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/* eslint-disable no-bitwise -- the amount mask is XOR */

import { RistrettoPoint } from '@noble/curves/ed25519';
import { blake3 } from '@noble/hashes/blake3';
import { decodeAddressKeys } from './address';
import { domainHash, hashToPoint, hashToScalar } from './hash';
import { bigintToBytesLE, bytesToHex, concatBytes, scalarFromCanonical } from './scalar';

/**
 * Opens a transaction's outputs with its sender opening, ported from
 * `samba_crypto::txn::validate_sender_opening`: the transaction key `r` and the recipients
 * (address, token, amount) the backend says each output pays recompute every output exactly, so
 * a backend can't show one payment and build another. It needs no view key.
 *
 * For output `j` paying `(A, B)`: `S = enc(r·A)`, the one-time key `H("samba/otk", S, j)·G + B`,
 * the view tag, the asset tag `H_token + H("samba/assetblind", S, j)·G`, the commitment
 * `v·tag + H("samba/blind", S, j)·G`, and the amount masked by `derive_key("samba/memo/v2", S, j)`.
 */

const mul = (point, scalar) => (scalar === 0n ? RistrettoPoint.ZERO : point.multiply(scalar));
const gMul = (scalar) => mul(RistrettoPoint.BASE, scalar);

function u32LE(n) {
  const out = new Uint8Array(4);
  new DataView(out.buffer).setUint32(0, n, true);
  return out;
}

/**
 * @param {Uint8Array} tokenId 32 bytes
 * @returns {RistrettoPoint} The token's generator `H_token`
 */
export function assetGenerator(tokenId) {
  return hashToPoint('samba/asset/v1', tokenId);
}

/**
 * What output `index` of a transaction keyed `r` must be, paying `amount` of `tokenId` to
 * `address`.
 *
 * @param {bigint} r
 * @param {string} address
 * @param {Uint8Array} tokenId
 * @param {bigint} amount
 * @param {number} index
 * @param {number} memoLen 8 (u64) or 16 (u128)
 * @returns {{ oneTimeKey: Uint8Array, viewTag: number, assetTag: Uint8Array,
 *   commitment: Uint8Array, memo: Uint8Array }}
 */
export function expectedOutput(r, address, tokenId, amount, index, memoLen) {
  const keys = decodeAddressKeys(address);
  const view = RistrettoPoint.fromHex(keys.view);
  const spend = RistrettoPoint.fromHex(keys.spend);
  const shared = mul(view, r).toRawBytes();
  const at = u32LE(index);
  const oneTimeKey = gMul(hashToScalar('samba/otk', [shared, at])).add(spend);
  const valueBlinder = hashToScalar('samba/blind', [shared, at]);
  const assetBlinder = hashToScalar('samba/assetblind', [shared, at]);
  const tag = assetGenerator(tokenId).add(gMul(assetBlinder));
  const commitment = mul(tag, amount).add(gMul(valueBlinder));
  const mask = blake3(concatBytes(shared, at), { context: 'samba/memo/v2' });
  const plain = bigintToBytesLE(amount);
  const memo = new Uint8Array(memoLen);
  for (let i = 0; i < memoLen; i += 1) {
    memo[i] = plain[i] ^ mask[i];
  }
  return {
    oneTimeKey: oneTimeKey.toRawBytes(),
    viewTag: domainHash('samba/viewtag', concatBytes(shared, at))[0],
    assetTag: tag.toRawBytes(),
    commitment: commitment.toRawBytes(),
    memo,
  };
}

/**
 * Checks every output of a parsed transaction against the recipient said to receive it.
 *
 * @param {Object} tx parseTxV2's result
 * @param {{ address: string, amount: bigint, tokenId: Uint8Array }[]} recipients In output order
 * @param {Uint8Array} senderOpening The transaction key `r`, 32 bytes
 * @throws {Error} When the opening doesn't open the transaction, or an output pays anything else
 */
export function checkOpening(tx, recipients, senderOpening) {
  if (recipients.length !== tx.outputs.length) {
    throw new Error('Every output needs a recipient.');
  }
  const r = scalarFromCanonical(senderOpening);
  if (r === 0n || bytesToHex(gMul(r).toRawBytes()) !== bytesToHex(tx.rPub)) {
    throw new Error('The opening is not this transaction\'s key.');
  }
  const maxAmount = tx.width === 'u64' ? 2n ** 64n - 1n : 2n ** 128n - 1n;
  const memoLen = tx.width === 'u64' ? 8 : 16;
  tx.outputs.forEach((output, index) => {
    const recipient = recipients[index];
    if (recipient.amount < 0n || recipient.amount > maxAmount) {
      throw new Error(`Output ${index} pays an amount out of range.`);
    }
    const want = expectedOutput(
      r,
      recipient.address,
      recipient.tokenId,
      recipient.amount,
      index,
      memoLen,
    );
    const same = bytesToHex(want.oneTimeKey) === bytesToHex(output.oneTimeKey)
      && want.viewTag === output.viewTag
      && bytesToHex(want.assetTag) === bytesToHex(output.assetTag)
      && bytesToHex(want.commitment) === bytesToHex(output.commitment)
      && bytesToHex(want.memo) === bytesToHex(output.memo);
    if (!same) {
      throw new Error(`Output ${index} doesn't pay what it says.`);
    }
  });
}
