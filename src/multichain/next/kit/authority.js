/**
 * Copyright (c) Hathor Labs and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { hashToScalar } from './hash';
import { publicKeyOf } from './keys';
import { bytesToHex, u64LE } from './scalar';

/**
 * A token's mint and melt authorities, derived from the seed, ported from
 * `samba-wallet-sdk/src/authority.rs` (`specs/token-authority-derivation.md`). The public halves
 * go into the token's creation body; the secrets sign a mint or a melt. Both are pure functions of
 * the BIP39 seed, the account and a nonce, so a wallet restored from its words still holds them,
 * and nothing about them is backed up but the words.
 *
 *   sk = hash_to_scalar(domain, seed64 ‖ account u32 LE ‖ nonce u64 LE),  pub = sk·G
 *
 * The nonce is an index, not a secret, and it never reaches the chain: a wallet finds it again by
 * deriving its keys at nonce 0, 1, 2… and looking for them in the token registry. Handing out a
 * nonce twice would put the same keys on two tokens, a public link between them that can't be
 * undone, so a creation takes a nonce the scan and this device's own records both show is free.
 */

export const MINT_DOMAIN = 'samba/token-authority/mint/v1';
export const MELT_DOMAIN = 'samba/token-authority/melt/v1';

/** The scan stops this many nonces past the highest one the registry knows. */
export const AUTHORITY_GAP = 20;

const DOMAINS = { mint: MINT_DOMAIN, melt: MELT_DOMAIN };

function u32LE(n) {
  const out = new Uint8Array(4);
  new DataView(out.buffer).setUint32(0, n, true);
  return out;
}

/**
 * One authority's secret and public key.
 *
 * @param {Uint8Array} seed64 The BIP39 seed
 * @param {number} accountIndex The Hathor Next account (3 in this wallet)
 * @param {'mint'|'melt'} kind
 * @param {number} nonce
 * @returns {{ secret: bigint, pub: Uint8Array }}
 */
export function deriveAuthority(seed64, accountIndex, kind, nonce) {
  const domain = DOMAINS[kind];
  if (!domain) {
    throw new Error('An authority is a mint or a melt one.');
  }
  if (!Number.isSafeInteger(nonce) || nonce < 0) {
    throw new Error('The nonce is out of range.');
  }
  const secret = hashToScalar(domain, [seed64, u32LE(accountIndex), u64LE(nonce)]);
  return { secret, pub: publicKeyOf(secret) };
}

/** The registry listed a token with an authority and left its key out. */
export class AuthoritiesWithheldError extends Error {
  constructor() {
    super('The token registry left out an authority key, so the wallet can\'t tell which nonces are taken.');
    this.name = 'AuthoritiesWithheldError';
  }
}

/** A registry row that doesn't read: no answer can rest on it. */
export class RegistryUnreadableError extends Error {
  constructor() {
    super('The token registry sent a row this wallet can\'t read.');
    this.name = 'RegistryUnreadableError';
  }
}

/**
 * Which nonces this seed already used: its keys at nonce 0, 1, 2… looked up among the registry's
 * authority keys, until `gap` nonces in a row past the highest match find nothing.
 *
 * A token that has an authority but whose key the registry withholds makes the answer unknown, not
 * "none": a wallet reading it as "none" could hand out a nonce already on chain.
 *
 * @param {(kind: 'mint'|'melt', nonce: number) => Uint8Array} derivePub
 * @param {{ token_id: string, has_mint_authority: boolean, has_melt_authority: boolean,
 *   mint_authority?: string, melt_authority?: string }[]} registry Every token, keys included
 * @param {number} [gap]
 * @returns {{ highest: number, held: { tokenId: string, nonce: number, mint: boolean,
 *   melt: boolean }[] }} `highest` is -1 when this seed created nothing
 * @throws {AuthoritiesWithheldError}
 */
export function scanAuthorities(derivePub, registry, gap = AUTHORITY_GAP) {
  if (!Array.isArray(registry)) {
    throw new RegistryUnreadableError();
  }
  const hex32 = /^[0-9a-fA-F]{64}$/;
  const keys = new Map();
  for (const row of registry) {
    // A row read wrongly as "no key here" would hand out a nonce already on chain: every field
    // the answer rests on must be there and well formed, and keys compare as bytes.
    if (!row || !hex32.test(row.token_id ?? '')
      || typeof row.has_mint_authority !== 'boolean'
      || typeof row.has_melt_authority !== 'boolean') {
      throw new RegistryUnreadableError();
    }
    if ((row.has_mint_authority && !row.mint_authority)
      || (row.has_melt_authority && !row.melt_authority)) {
      throw new AuthoritiesWithheldError();
    }
    const tokenId = row.token_id.toLowerCase();
    for (const [kind, key] of [['mint', row.mint_authority], ['melt', row.melt_authority]]) {
      if (key === undefined || key === null) {
        continue;
      }
      if (!hex32.test(key)) {
        throw new RegistryUnreadableError();
      }
      keys.set(key.toLowerCase(), { tokenId, kind });
    }
  }
  let highest = -1;
  const held = new Map();
  for (let nonce = 0; nonce <= highest + gap; nonce += 1) {
    for (const kind of ['mint', 'melt']) {
      const hit = keys.get(bytesToHex(derivePub(kind, nonce)));
      // Any match takes the nonce, as the Rust scan counts it. Only a match in the same column is
      // a power this wallet holds: its melt key in a token's mint slot mints nothing.
      if (hit) {
        highest = nonce;
        if (hit.kind === kind) {
          const entry = held.get(hit.tokenId)
            ?? { tokenId: hit.tokenId, nonce, mint: false, melt: false };
          entry[kind] = true;
          held.set(hit.tokenId, entry);
        }
      }
    }
  }
  return { highest, held: [...held.values()] };
}

/** The nonce a creation would take lies past what a restored wallet's scan can find. */
export class NonceBeyondReachError extends Error {
  constructor() {
    super('Too many token creations were started without finishing: a new one couldn\'t be found again from the words.');
    this.name = 'NonceBeyondReachError';
  }
}

/**
 * The nonce a creation may take: one past the highest nonce anyone knows is taken, the registry
 * (`highest`) or this device (what it reserved, and the highest it ever signed a creation at).
 *
 * @param {{ highest: number, reserved: number[], signedFloor: number|null, gap?: number }} known
 * @returns {number}
 * @throws {NonceBeyondReachError} When a scan from the words alone would stop before it
 */
export function nextNonce({ highest, reserved, signedFloor, gap = AUTHORITY_GAP }) {
  const taken = Math.max(highest, signedFloor ?? -1, ...reserved);
  const next = taken + 1;
  if (next > highest + gap) {
    throw new NonceBeyondReachError();
  }
  return next;
}
