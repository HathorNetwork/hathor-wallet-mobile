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

/** The token id a creation's supply names: its transaction's own id, unknown inside it. */
export const CREATED_TOKEN_ID = new Uint8Array(32).fill(0xff);

const TOKEN_INDEX_NATIVE = 255;
const TOKEN_INDEX_CREATED = 254;

/**
 * The token an amount-shielded or transparent output names, from its index.
 *
 * @param {Object} tx readTxV3's result
 * @param {number} index
 * @param {Uint8Array} nativeTokenId
 * @param {'amount-shielded'|'transparent'} [form] The output's kind
 * @returns {Uint8Array}
 */
export function tokenOfIndex(tx, index, nativeTokenId, form = 'transparent') {
  if (index === TOKEN_INDEX_NATIVE) {
    return nativeTokenId;
  }
  if (index === TOKEN_INDEX_CREATED) {
    // As the node reads it: only a creation's transparent outputs hold the token it creates.
    if (tx.kind !== 'token-create' || form !== 'transparent') {
      throw new Error('Only a token creation\'s transparent outputs name the token it creates.');
    }
    return CREATED_TOKEN_ID;
  }
  const entry = tx.table[index];
  if (!entry) {
    throw new Error('An output names a token the transaction doesn\'t list.');
  }
  return entry;
}

/** The kind of output each confidentiality level writes, from level 1 to 4. */
const LEVEL_FORMS = [null, 'transparent', 'amount-shielded', 'shielded', 'shielded'];

/**
 * Checks every output of a v3 transaction against the recipient said to receive it, at the level
 * the signer approved for it, never the one the bytes or the backend name, ported from
 * `samba_crypto::txn::validate_sender_opening_levels`: level 4 is shielded and stealth, 3 shielded
 * and declared (paying `P = B`, the recipient's spend key), 2 amount-shielded and 1 transparent,
 * both declared. A creation's supply and change are level 1. An output of another kind than its
 * level's is refused.
 *
 * For output `j` paying `(A, B)`: `S = enc(r·A)`; the one-time key is `B` when declared and
 * `H("samba/otk", S, j)·G + B` otherwise; the view tag comes from `S` either way. A shielded
 * output's asset tag, commitment and masked amount recompute from `S`; an amount-shielded one's
 * token is in the clear and its commitment is over `H_token`; a transparent one's token and amount
 * are in the clear.
 *
 * @param {Object} tx readTxV3's result
 * @param {{ address: string, amount: bigint, tokenId: Uint8Array, level: 1|2|3|4 }[]}
 *   recipients In output order
 * @param {Uint8Array} senderOpening The transaction key `r`, 32 bytes
 * @param {Uint8Array} nativeTokenId
 * @throws {Error} When the opening doesn't open the transaction, or an output pays anything else
 */
export function checkOpeningLevels(tx, recipients, senderOpening, nativeTokenId) {
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
    const form = LEVEL_FORMS[recipient.level];
    if (!form) {
      throw new Error(`Output ${index} has no level.`);
    }
    if (output.form !== form) {
      throw new Error(`Output ${index} is ${output.form}, not level ${recipient.level}.`);
    }
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
    const keys = decodeAddressKeys(recipient.address);
    const oneTimeKey = recipient.level < 4 ? keys.spend : want.oneTimeKey;
    let same = bytesToHex(oneTimeKey) === bytesToHex(output.oneTimeKey)
      && want.viewTag === output.viewTag;
    if (output.form === 'shielded') {
      // A shielded output can't hold the token a creation creates: its generator would be the
      // transaction's own id.
      if (bytesToHex(recipient.tokenId) === bytesToHex(CREATED_TOKEN_ID)) {
        throw new Error(`Output ${index} claims the created token on a shielded output.`);
      }
      same = same
        && bytesToHex(want.assetTag) === bytesToHex(output.assetTag)
        && bytesToHex(want.commitment) === bytesToHex(output.commitment)
        && bytesToHex(want.memo) === bytesToHex(output.memo);
    } else {
      const token = tokenOfIndex(tx, output.tokenIndex, nativeTokenId, output.form);
      same = same && bytesToHex(token) === bytesToHex(recipient.tokenId);
      if (output.form === 'amount-shielded') {
        // No asset blinder: the tag is H_token itself.
        const shared = mul(RistrettoPoint.fromHex(keys.view), r).toRawBytes();
        const blinder = hashToScalar('samba/blind', [shared, u32LE(index)]);
        const commitment = mul(assetGenerator(recipient.tokenId), recipient.amount)
          .add(gMul(blinder));
        same = same
          && bytesToHex(commitment.toRawBytes()) === bytesToHex(output.commitment)
          && bytesToHex(want.memo) === bytesToHex(output.memo);
      } else {
        same = same && output.amount === recipient.amount;
      }
    }
    if (!same) {
      throw new Error(`Output ${index} doesn't pay what it says.`);
    }
  });
}
