/**
 * Copyright (c) Hathor Labs and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/* eslint-disable no-bitwise -- the flags and authority bytes are bit sets */

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
 * Reads wire format v3, ported from `samba-types/src/tx_v3.rs`: transparent inputs (the index
 * family), and outputs of three kinds, with every proof and signature after the core, in a
 * witness of its own. The wallet reads what the backend built to check it before signing. Two
 * readers sit on top of `readTxV3`: `parseTxV3`, a plain transfer with full shielded outputs and
 * an excess (a payment), and the issuance one in tx.js. The ring family and stake kinds are
 * refused.
 *
 * Layout, integers little-endian, W = 8 (u64) or 16 (u128):
 *   core:    version u8 ‖ flags u8 ‖ kind u8 ‖ n_in u8 ‖ n_shielded u8 ‖ n_amount_shielded u8 ‖
 *            n_transparent_out u8 ‖ r_pub 32 ‖ fee_token u8 ‖ fee_amount W ‖
 *            table_len u8 ‖ table 32×len ‖ inputs (output_index u64 each) ‖
 *            shielded outputs ‖ amount-shielded outputs ‖ transparent outputs ‖
 *            mint/melt body (token 32 ‖ amount W) ‖ excess E 32 (unless fully transparent) ‖
 *            definition (token-create: symbol_len u8 ‖ name_len u8 ‖ authority bits u8 ‖ symbol ‖
 *            name ‖ [mint authority 32] ‖ [melt authority 32])
 *   shielded output:        one_time_key 32 ‖ asset_tag 32 ‖ commitment 32 ‖ limb_lo 32 ‖
 *                           [limb_hi 32] ‖ view_tag u8 ‖ memo W
 *   amount-shielded output: one_time_key 32 ‖ view_tag u8 ‖ token u8 ‖ commitment 32 ‖
 *                           limb_lo 32 ‖ [limb_hi 32] ‖ memo W
 *   transparent output:     one_time_key 32 ‖ view_tag u8 ‖ token u8 ‖ amount W
 *   witness: input signatures 64×n_in ‖ links (160|256)×(shielded + amount-shielded) ‖
 *            surjections (36 + 32·(n_in + mints))×shielded ‖ range proof (if any committed
 *            output) ‖ excess signature 64 (unless fully transparent) ‖ authority signature 64
 *            (mint, melt)
 *
 * A token is named by its index: 255 the native token, 254 the token a creation creates (its own
 * transaction id), anything else an entry of the table.
 */

/** The version bytes of v3's index family (transparent inputs): u64 or u128. */
export const V3_INDEX = { 0x40: 'u64', 0x41: 'u128' };

/** The kind byte. */
export const V3_KIND = { 0: 'transfer', 1: 'token-create', 2: 'mint', 3: 'melt' };

/** The token a creation creates: its own transaction's id, which no byte inside it can hold. */
export const TOKEN_INDEX_CREATED = 254;

const HEADER_LEN = 7;
const FLAG_FULLY_TRANSPARENT = 1;
const FLAG_MINTS = 2;
const FLAGS_KNOWN = FLAG_FULLY_TRANSPARENT | FLAG_MINTS;
const CREATE_MINT_AUTHORITY = 1;
const CREATE_MELT_AUTHORITY = 2;
const CREATE_BITS_KNOWN = CREATE_MINT_AUTHORITY | CREATE_MELT_AUTHORITY;
const EXCESS_SIG_LEN = 64;
const AUTHORITY_SIG_LEN = 64;

// The fewest inputs and outputs each kind allows: a creation may be bare, a mint needs an output
// to hold what it issues, a melt may destroy everything it spends.
const MIN_COUNTS = {
  transfer: [1, 1],
  'token-create': [0, 0],
  mint: [0, 1],
  melt: [1, 0],
};

const unreadable = () => new Error('Not a transaction this wallet signs.');
const tooShort = () => new Error('The transaction is not as long as its header says.');

/**
 * Reads any index-family v3 transaction of a kind this wallet knows.
 *
 * @param {Uint8Array} bytes
 * @returns {Object} Every field, and where each witness section is
 * @throws {Error} For anything else, or bytes that disagree with their header
 */
export function readTxV3(bytes) {
  const width = V3_INDEX[bytes[0]];
  if (!width) {
    throw unreadable();
  }
  const flags = bytes[1];
  const kind = V3_KIND[bytes[2]];
  if ((flags & ~FLAGS_KNOWN) !== 0 || !kind) {
    throw unreadable();
  }
  const mints = (flags & FLAG_MINTS) !== 0;
  if (mints !== (kind === 'mint')) {
    throw unreadable();
  }
  const fullyTransparent = (flags & FLAG_FULLY_TRANSPARENT) !== 0;
  const excess = !fullyTransparent;
  const mintOrMelt = kind === 'mint' || kind === 'melt';
  const nIn = bytes[3];
  const nShielded = bytes[4];
  const nAmount = bytes[5];
  const nTransparent = bytes[6];
  const nOut = nShielded + nAmount + nTransparent;
  const [minIn, minOut] = MIN_COUNTS[kind];
  if (nIn < minIn || nIn > MAX_INPUTS || nOut < minOut || nOut > MAX_OUTPUTS) {
    throw new Error('The transaction has too few or too many inputs or outputs.');
  }
  if (fullyTransparent && (nShielded > 0 || nAmount > 0)) {
    throw unreadable();
  }
  const u128 = width === 'u128';
  const amountLen = u128 ? 16 : 8;
  const memoLen = amountLen;
  const readAmount = (at) => bytesToBigintLE(bytes.slice(at, at + amountLen));
  if (bytes.length < HEADER_LEN + 32 + 2 + amountLen) {
    throw tooShort();
  }
  const rPub = bytes.slice(HEADER_LEN, HEADER_LEN + 32);
  const feeOff = HEADER_LEN + 32;
  const feeTokenIndex = bytes[feeOff];
  const feeAmount = readAmount(feeOff + 1);
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
  const shieldedOff = inputsOff + 8 * nIn;
  const shieldedLen = 32 * (u128 ? 5 : 4) + 1 + memoLen;
  const amountOutOff = shieldedOff + nShielded * shieldedLen;
  const amountOutLen = 32 + 1 + 1 + 32 * (u128 ? 3 : 2) + memoLen;
  const transparentOff = amountOutOff + nAmount * amountOutLen;
  const transparentLen = 32 + 1 + 1 + amountLen;
  const bodyOff = transparentOff + nTransparent * transparentLen;
  const bodyLen = mintOrMelt ? 32 + amountLen : 0;
  const excessPointOff = bodyOff + bodyLen;
  const createOff = excessPointOff + (excess ? 32 : 0);
  let createLen = 0;
  let definition = null;
  if (kind === 'token-create') {
    if (bytes.length < createOff + 3) {
      throw tooShort();
    }
    const symbolLen = bytes[createOff];
    const nameLen = bytes[createOff + 1];
    const bits = bytes[createOff + 2];
    if ((bits & ~CREATE_BITS_KNOWN) !== 0) {
      throw unreadable();
    }
    const symbolOff = createOff + 3;
    const nameOff = symbolOff + symbolLen;
    let keyOff = nameOff + nameLen;
    const key = () => {
      const k = bytes.slice(keyOff, keyOff + 32);
      keyOff += 32;
      return k;
    };
    definition = {
      symbol: bytes.slice(symbolOff, nameOff),
      name: bytes.slice(nameOff, nameOff + nameLen),
      mintAuthority: (bits & CREATE_MINT_AUTHORITY) ? key() : null,
      meltAuthority: (bits & CREATE_MELT_AUTHORITY) ? key() : null,
    };
    createLen = keyOff - createOff;
  }
  const coreLen = createOff + createLen;

  const committed = nShielded + nAmount;
  const sigsOff = coreLen;
  const linksOff = sigsOff + SIG_LEN * nIn;
  const surjectionsOff = linksOff + committed * (u128 ? 256 : 160);
  const ring = nIn + (mints ? 1 : 0);
  const rangeOff = surjectionsOff + nShielded * (36 + 32 * ring);
  const excessSigOff = rangeOff + (committed > 0 ? rangeProofLen(u128, committed) : 0);
  const authoritySigOff = excessSigOff + (excess ? EXCESS_SIG_LEN : 0);
  const end = authoritySigOff + (mintOrMelt ? AUTHORITY_SIG_LEN : 0);
  if (bytes.length !== end) {
    throw tooShort();
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
  for (let j = 0; j < nShielded; j += 1) {
    const o = shieldedOff + j * shieldedLen;
    const tagOff = o + 32 * (u128 ? 5 : 4);
    outputs.push({
      form: 'shielded',
      oneTimeKey: bytes.slice(o, o + 32),
      assetTag: bytes.slice(o + 32, o + 64),
      commitment: bytes.slice(o + 64, o + 96),
      viewTag: bytes[tagOff],
      memo: bytes.slice(tagOff + 1, tagOff + 1 + memoLen),
    });
  }
  for (let j = 0; j < nAmount; j += 1) {
    const o = amountOutOff + j * amountOutLen;
    const memoOff = o + 34 + 32 * (u128 ? 3 : 2);
    outputs.push({
      form: 'amount-shielded',
      oneTimeKey: bytes.slice(o, o + 32),
      viewTag: bytes[o + 32],
      tokenIndex: bytes[o + 33],
      commitment: bytes.slice(o + 34, o + 66),
      memo: bytes.slice(memoOff, memoOff + memoLen),
    });
  }
  for (let j = 0; j < nTransparent; j += 1) {
    const o = transparentOff + j * transparentLen;
    outputs.push({
      form: 'transparent',
      oneTimeKey: bytes.slice(o, o + 32),
      viewTag: bytes[o + 32],
      tokenIndex: bytes[o + 33],
      amount: readAmount(o + 34),
    });
  }
  return {
    format: 'v3',
    width,
    kind,
    fullyTransparent,
    nIn,
    nOut,
    rPub,
    feeTokenIndex,
    feeAmount,
    table,
    inputs,
    outputs,
    body: mintOrMelt
      ? { tokenId: bytes.slice(bodyOff, bodyOff + 32), amount: readAmount(bodyOff + 32) }
      : null,
    definition,
    excess: excess
      ? {
        point: bytes.slice(excessPointOff, excessPointOff + 32),
        signature: bytes.slice(excessSigOff, excessSigOff + EXCESS_SIG_LEN),
        signatureOffset: excessSigOff,
      }
      : null,
    authority: mintOrMelt
      ? {
        signature: bytes.slice(authoritySigOff, end),
        signatureOffset: authoritySigOff,
      }
      : null,
    sections: {
      coreLen,
      sigs: sigsOff,
      links: linksOff,
      surjections: surjectionsOff,
      range: rangeOff,
      excessSig: excessSigOff,
      authoritySig: authoritySigOff,
      end,
    },
  };
}

/**
 * Parses a v3 payment: a plain transfer, full shielded outputs and an excess. Same fields as
 * parseTxV2, plus where each witness section is.
 *
 * @param {Uint8Array} bytes
 * @returns {Object}
 * @throws {Error} For any other transaction, or bytes that disagree with their header
 */
export function parseTxV3(bytes) {
  // Only what a payment can be is read: anything else is refused for what it is, before a byte
  // past the header is.
  if (!V3_INDEX[bytes[0]] || bytes[1] !== 0 || bytes[2] !== 0) {
    throw unreadable();
  }
  if (bytes[5] !== 0 || bytes[6] !== 0) {
    throw new Error('The transaction has outputs this wallet does not sign.');
  }
  return readTxV3(bytes);
}

/**
 * What every input signs, and a mint's or melt's authority:
 * `blake3("samba/txhash" ‖ 0 ‖ core ‖ links ‖ surjections ‖ range)`. The signatures are left
 * out, not zeroed as in v2, so the signed bytes give the same hash.
 *
 * @param {Uint8Array} bytes
 * @param {Object} tx readTxV3(bytes)
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
 * hashes each witness section on its own (`TxV3View::witness_root`). A creation's token id is its
 * transaction's id.
 *
 * @param {Uint8Array} bytes The signed transaction
 * @param {Object} tx readTxV3(bytes)
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
    authoritySig,
    end,
  } = tx.sections;
  // Six fixed slots; this wallet's transactions have no ring signatures.
  const leaves = concatBytes(
    domainHash('samba/wit/input', bytes.subarray(sigs, links)),
    domainHash('samba/wit/link', bytes.subarray(links, surjections)),
    domainHash('samba/wit/surjection', bytes.subarray(surjections, range)),
    domainHash('samba/wit/range', bytes.subarray(range, excessSig)),
    domainHash('samba/wit/excess', bytes.subarray(excessSig, authoritySig)),
    domainHash('samba/wit/authority', bytes.subarray(authoritySig, end)),
  );
  const witnessRoot = domainHash('samba/witness', leaves);
  return domainHash('samba/txid', concatBytes(bytes.subarray(0, coreLen), witnessRoot));
}
