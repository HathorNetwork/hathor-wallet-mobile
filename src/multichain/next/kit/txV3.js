/**
 * Copyright (c) Hathor Labs and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { domainHash } from './hash';
import { bytesToBigintLE, concatBytes } from './scalar';
import {
  MAX_INPUTS,
  MAX_OUTPUTS,
  MAX_TOKEN_TABLE,
  SIG_LEN,
  rangeProofLen,
} from './txV2';

/**
 * Reads the same transfer as txV2.js in wire format v3, ported from `samba-types/src/tx_v3.rs`:
 * transparent inputs, full shielded outputs and an excess, with every proof and signature after
 * the core, in a witness of its own. The wallet reads it to check it before signing; any other
 * v3 transaction (another kind, the ring family, amount-shielded or transparent outputs, the fully
 * transparent form) is refused.
 *
 * Layout, integers little-endian:
 *   core:    version u8 ‖ flags u8 ‖ kind u8 ‖ n_in u8 ‖ n_shielded u8 ‖ n_amount_shielded u8 ‖
 *            n_transparent_out u8 ‖ r_pub 32 ‖ fee_token u8 ‖ fee_amount (8|16) ‖
 *            table_len u8 ‖ table 32×len ‖ inputs (output_index u64 each) ‖ outputs ‖ excess E 32
 *   output:  one_time_key 32 ‖ asset_tag 32 ‖ commitment 32 ‖ limb_lo 32 ‖ [limb_hi 32] ‖
 *            view_tag u8 ‖ memo (8|16)
 *   witness: input signatures 64×n_in ‖ links (160|256)×n_out ‖ surjections (36 + 32·n_in)×n_out
 *            ‖ range_proof ‖ excess signature (R ‖ s) 64
 */

/** The version bytes of v3's index family (transparent inputs): u64 or u128. */
export const V3_INDEX = { 0x40: 'u64', 0x41: 'u128' };

const HEADER_LEN = 7;
const KIND_TRANSFER = 0;
const EXCESS_SIG_LEN = 64;

/**
 * Parses a v3 transfer. Same fields as parseTxV2, plus where each witness section is.
 *
 * @param {Uint8Array} bytes
 * @returns {Object}
 * @throws {Error} For any other transaction, or bytes that disagree with their header
 */
export function parseTxV3(bytes) {
  const width = V3_INDEX[bytes[0]];
  if (!width) {
    throw new Error('Not a transaction this wallet signs.');
  }
  // No flag: an excess, and no issuance. Kind 0: a plain transfer, with no kind body.
  if (bytes[1] !== 0 || bytes[2] !== KIND_TRANSFER) {
    throw new Error('Not a transaction this wallet signs.');
  }
  const nIn = bytes[3];
  const nOut = bytes[4];
  if (bytes[5] !== 0 || bytes[6] !== 0) {
    throw new Error('The transaction has outputs this wallet does not sign.');
  }
  if (!nIn || nIn > MAX_INPUTS || !nOut || nOut > MAX_OUTPUTS) {
    throw new Error('The transaction has too few or too many inputs or outputs.');
  }
  const u128 = width === 'u128';
  const amountLen = u128 ? 16 : 8;
  const rPub = bytes.slice(HEADER_LEN, HEADER_LEN + 32);
  const feeOff = HEADER_LEN + 32;
  const feeTokenIndex = bytes[feeOff];
  const feeAmount = bytesToBigintLE(bytes.slice(feeOff + 1, feeOff + 1 + amountLen));
  const tableLenOff = feeOff + 1 + amountLen;
  const tableLen = bytes[tableLenOff];
  if (tableLen > MAX_TOKEN_TABLE) {
    throw new Error('The transaction names too many tokens.');
  }
  const tableOff = tableLenOff + 1;
  const table = [];
  for (let i = 0; i < tableLen; i += 1) {
    table.push(bytes.slice(tableOff + 32 * i, tableOff + 32 * (i + 1)));
  }
  const inputsOff = tableOff + 32 * tableLen;
  const memoLen = u128 ? 16 : 8;
  const points = u128 ? 5 : 4;
  const outputLen = 32 * points + 1 + memoLen;
  const outputsOff = inputsOff + 8 * nIn;
  const excessPointOff = outputsOff + nOut * outputLen;
  const coreLen = excessPointOff + 32;

  const sigsOff = coreLen;
  const linksOff = sigsOff + SIG_LEN * nIn;
  const surjectionsOff = linksOff + nOut * (u128 ? 256 : 160);
  const rangeOff = surjectionsOff + nOut * (36 + 32 * nIn);
  const excessSigOff = rangeOff + rangeProofLen(u128, nOut);
  if (bytes.length !== excessSigOff + EXCESS_SIG_LEN) {
    throw new Error('The transaction is not as long as its header says.');
  }

  const inputs = [];
  for (let i = 0; i < nIn; i += 1) {
    const o = inputsOff + 8 * i;
    inputs.push({
      outputIndex: bytesToBigintLE(bytes.slice(o, o + 8)),
      signatureOffset: sigsOff + SIG_LEN * i,
    });
  }
  const outputs = [];
  for (let j = 0; j < nOut; j += 1) {
    const o = outputsOff + j * outputLen;
    const tagOff = o + 32 * points;
    outputs.push({
      oneTimeKey: bytes.slice(o, o + 32),
      assetTag: bytes.slice(o + 32, o + 64),
      commitment: bytes.slice(o + 64, o + 96),
      viewTag: bytes[tagOff],
      memo: bytes.slice(tagOff + 1, tagOff + 1 + memoLen),
    });
  }
  return {
    format: 'v3',
    width,
    nIn,
    nOut,
    rPub,
    feeTokenIndex,
    feeAmount,
    table,
    inputs,
    outputs,
    excess: {
      point: bytes.slice(excessPointOff, coreLen),
      signature: bytes.slice(excessSigOff, excessSigOff + EXCESS_SIG_LEN),
      signatureOffset: excessSigOff,
    },
    sections: {
      coreLen,
      sigs: sigsOff,
      links: linksOff,
      surjections: surjectionsOff,
      range: rangeOff,
      excessSig: excessSigOff,
    },
  };
}

/**
 * What every input signs: `blake3("samba/txhash" ‖ 0 ‖ core ‖ links ‖ surjections ‖ range)`. The
 * signatures are left out, not zeroed as in v2, so the signed bytes give the same hash.
 *
 * @param {Uint8Array} bytes
 * @param {Object} tx parseTxV3(bytes)
 * @returns {Uint8Array} 32 bytes
 */
export function signingHashOfV3(bytes, tx) {
  const { coreLen, links, excessSig } = tx.sections;
  return domainHash('samba/txhash', concatBytes(
    bytes.subarray(0, coreLen),
    bytes.subarray(links, excessSig),
  ));
}

/**
 * A v3 transaction's id: `blake3("samba/txid" ‖ 0 ‖ core ‖ witness_root)`, where the witness root
 * hashes each witness section on its own (`TxV3View::witness_root`).
 *
 * @param {Uint8Array} bytes The signed transaction
 * @param {Object} tx parseTxV3(bytes)
 * @returns {Uint8Array} 32 bytes
 */
export function txIdOfV3(bytes, tx) {
  const {
    coreLen,
    sigs,
    links,
    surjections,
    range,
    excessSig,
  } = tx.sections;
  // Six fixed slots; this transfer has no ring signatures and no authority signature.
  const leaves = concatBytes(
    domainHash('samba/wit/input', bytes.subarray(sigs, links)),
    domainHash('samba/wit/link', bytes.subarray(links, surjections)),
    domainHash('samba/wit/surjection', bytes.subarray(surjections, range)),
    domainHash('samba/wit/range', bytes.subarray(range, excessSig)),
    domainHash('samba/wit/excess', bytes.subarray(excessSig, bytes.length)),
    domainHash('samba/wit/authority', new Uint8Array(0)),
  );
  const witnessRoot = domainHash('samba/witness', leaves);
  return domainHash('samba/txid', concatBytes(bytes.subarray(0, coreLen), witnessRoot));
}
