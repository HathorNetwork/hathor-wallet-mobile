/**
 * Copyright (c) Hathor Labs and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { describe, it, expect } from '@jest/globals';
import { utf8ToBytes } from '@noble/hashes/utils';
import vectors from './fixtures/remote-issuance.json';
import authorityVectors from './fixtures/token-authority.json';
import signingVectors from './fixtures/remote-signing.json';
import {
  parseIssuanceTx,
  parseTx,
  signingHashOf,
  txIdOf,
  withAuthoritySignature,
  withInputSignatures,
} from '../../../src/multichain/next/kit/tx';
import {
  AUTHORITY_DOMAIN,
  INPUT_DOMAIN,
  signAuthority,
  signInput,
  verifyIn,
} from '../../../src/multichain/next/kit/inputSig';
import { checkOpeningLevels, tokenOfIndex } from '../../../src/multichain/next/kit/opening';
import { publicKeyOf } from '../../../src/multichain/next/kit/keys';
import {
  AUTHORITY_GAP,
  AuthoritiesWithheldError,
  NonceBeyondReachError,
  deriveAuthority,
  nextNonce,
  scanAuthorities,
} from '../../../src/multichain/next/kit/authority';
import {
  bytesToBigintLE,
  bytesToHex,
  hexToBytes,
  modOrder,
} from '../../../src/multichain/next/kit/scalar';

// The vectors are crates/samba-wallet-sdk/tests/remote_issuance.rs's (the hathor-next repository,
// clients/wallet-sdk/fixtures/remote-issuance/v1.json) and token_authority_vectors.rs's
// (clients/wallet-sdk/fixtures/token-authority/v1.json), copied unchanged.

const native = hexToBytes(vectors.native_token);

// The level the signer approves, from what it asked for and never from the vector's claims: a
// creation's outputs are level 1, and these mints and melts pay this wallet at level 4.
const approvedLevel = (vector) => (vector.kind === 'token-create' ? 1 : 4);

const recipientsOf = (vector) => vector.outputs.map((o) => ({
  address: o.address,
  amount: BigInt(o.amount),
  tokenId: hexToBytes(o.token),
  level: approvedLevel(vector),
}));

describe.each(vectors.cases)('the remote-issuance case "$name"', (vector) => {
  const bytes = hexToBytes(vector.unsigned_tx);

  it('reads as the issuance it is, and never as a payment', () => {
    const tx = parseIssuanceTx(bytes);
    expect(tx.kind).toBe(vector.kind);
    expect(tx.feeAmount).toBe(BigInt(vector.fee));
    expect(tx.inputs.map((i) => i.outputIndex))
      .toEqual(vector.inputs.map((i) => BigInt(i.global_index)));
    expect(tx.outputs.map((o) => o.form)).toEqual(vector.outputs.map((o) => o.output_kind));
    expect(() => parseTx(bytes)).toThrow();
    if (vector.kind === 'token-create') {
      const utf8 = (text) => bytesToHex(utf8ToBytes(text));
      expect(bytesToHex(tx.definition.symbol)).toBe(utf8(vector.approved.symbol));
      expect(bytesToHex(tx.definition.name)).toBe(utf8(vector.approved.name));
      expect(bytesToHex(tx.definition.mintAuthority)).toBe(vector.approved.mint_authority);
      expect(bytesToHex(tx.definition.meltAuthority)).toBe(vector.approved.melt_authority);
      expect(tx.authority).toBeNull();
    } else {
      expect(bytesToHex(tx.body.tokenId)).toBe(vector.approved.token);
      expect(tx.body.amount).toBe(BigInt(vector.approved.amount));
      expect(tx.authority).not.toBeNull();
    }
    // A creation from public funds has nothing hidden: no excess.
    expect(tx.excess === null).toBe(tx.fullyTransparent);
  });

  it('recomputes the signing hash from the bytes', () => {
    const tx = parseIssuanceTx(bytes);
    expect(bytesToHex(signingHashOf(bytes, tx))).toBe(vector.signing_hash);
  });

  it('opens every output at its approved level, and refuses one that pays anything else', () => {
    const tx = parseIssuanceTx(bytes);
    const opening = hexToBytes(vector.sender_opening);
    const recipients = recipientsOf(vector);
    // Another wallet's address: the remote-signing vectors' payee (account 0 of the same words).
    const stranger = signingVectors.cases[0].approved.payments[0].address;
    expect(recipients.map((r) => r.address)).not.toContain(stranger);
    expect(() => checkOpeningLevels(tx, recipients, opening, native)).not.toThrow();
    const changed = (patch) => recipients.map((r, i) => (i === 0 ? { ...r, ...patch } : r));
    for (const patch of [
      { amount: recipients[0].amount + 1n },
      { tokenId: new Uint8Array(32).fill(8) },
      { address: stranger },
      // Every other level: another kind of output, or another recipient mode.
      ...[1, 2, 3, 4].filter((l) => l !== recipients[0].level).map((level) => ({ level })),
    ]) {
      expect(() => checkOpeningLevels(tx, changed(patch), opening, native)).toThrow();
    }
  });

  it('puts the given signatures in, and the id is the signed transaction\'s', () => {
    const tx = parseIssuanceTx(bytes);
    const hash = hexToBytes(vector.signing_hash);
    vector.signatures.forEach((sig, i) => {
      const key = hexToBytes(vector.inputs[i].one_time_key);
      expect(verifyIn(INPUT_DOMAIN, key, hash, hexToBytes(sig))).toBe(true);
    });
    let signed = withInputSignatures(bytes, tx, vector.signatures.map(hexToBytes));
    if (vector.authority) {
      const sig = hexToBytes(vector.authority_signature);
      expect(verifyIn(AUTHORITY_DOMAIN, hexToBytes(vector.authority), hash, sig)).toBe(true);
      signed = withAuthoritySignature(signed, tx, sig);
    } else {
      expect(() => withAuthoritySignature(signed, tx, new Uint8Array(64))).toThrow();
    }
    expect(bytesToHex(signed)).toBe(vector.signed_tx);
    expect(bytesToHex(txIdOf(signed))).toBe(vector.tx_id);
  });

  it('signs as the holder of the keys: each input and the authority over the hash', () => {
    const hash = hexToBytes(vector.signing_hash);
    const b = bytesToBigintLE(hexToBytes(vector.b));
    for (const input of vector.inputs) {
      const p = modOrder(bytesToBigintLE(hexToBytes(input.otk_offset)) + b);
      const key = hexToBytes(input.one_time_key);
      expect(bytesToHex(publicKeyOf(p))).toBe(input.one_time_key);
      expect(verifyIn(INPUT_DOMAIN, key, hash, signInput(p, key, hash))).toBe(true);
    }
    if (vector.authority_secret) {
      const x = bytesToBigintLE(hexToBytes(vector.authority_secret));
      expect(bytesToHex(publicKeyOf(x))).toBe(vector.authority);
      expect(verifyIn(AUTHORITY_DOMAIN, hexToBytes(vector.authority), hash, signAuthority(x, hash)))
        .toBe(true);
      // An input's challenge doesn't stand in for an authority's.
      expect(verifyIn(INPUT_DOMAIN, hexToBytes(vector.authority), hash, signAuthority(x, hash)))
        .toBe(false);
    }
  });
});

describe('the token a creation creates', () => {
  const create = parseIssuanceTx(hexToBytes(vectors.cases[0].unsigned_tx));
  const mint = parseIssuanceTx(hexToBytes(vectors.cases.find((c) => c.kind === 'mint').unsigned_tx));

  it('is named only by a creation\'s transparent outputs, as the node reads it', () => {
    expect(bytesToHex(tokenOfIndex(create, 254, native))).toBe('ff'.repeat(32));
    expect(() => tokenOfIndex(create, 254, native, 'amount-shielded')).toThrow();
    expect(() => tokenOfIndex(mint, 254, native)).toThrow();
  });

  it('is never claimed on a shielded output', () => {
    const tx = mint;
    const recipients = recipientsOf(vectors.cases.find((c) => c.kind === 'mint'))
      .map((r, i) => (i === 0 ? { ...r, tokenId: new Uint8Array(32).fill(0xff) } : r));
    expect(() => checkOpeningLevels(
      tx,
      recipients,
      hexToBytes(vectors.cases.find((c) => c.kind === 'mint').sender_opening),
      native,
    )).toThrow('created token');
  });
});

describe('token authorities', () => {
  const seed = hexToBytes(authorityVectors.seed64_hex);

  it.each(authorityVectors.vectors)('derive the shared vector at nonce $nonce', (v) => {
    const mint = deriveAuthority(seed, authorityVectors.account_index, 'mint', v.nonce);
    const melt = deriveAuthority(seed, authorityVectors.account_index, 'melt', v.nonce);
    expect(bytesToHex(mint.pub)).toBe(v.mint_pub_hex);
    expect(bytesToHex(melt.pub)).toBe(v.melt_pub_hex);
    expect(bytesToHex(publicKeyOf(mint.secret))).toBe(v.mint_pub_hex);
  });

  it('differ by account, and this wallet\'s account 3 holds none of account 0\'s', () => {
    const at0 = deriveAuthority(seed, 0, 'mint', 0);
    const at3 = deriveAuthority(seed, 3, 'mint', 0);
    expect(bytesToHex(at3.pub)).not.toBe(bytesToHex(at0.pub));
  });

  const derivePub = (kind, nonce) => deriveAuthority(seed, 3, kind, nonce).pub;
  const row = (tokenId, nonce, { mint = true, melt = true } = {}) => ({
    token_id: tokenId,
    has_mint_authority: mint,
    has_melt_authority: melt,
    ...(mint ? { mint_authority: bytesToHex(derivePub('mint', nonce)) } : {}),
    ...(melt ? { melt_authority: bytesToHex(derivePub('melt', nonce)) } : {}),
  });

  it('are found in the registry by scanning nonces, gap included', () => {
    const stranger = {
      token_id: 'ee'.repeat(32),
      has_mint_authority: true,
      has_melt_authority: false,
      mint_authority: bytesToHex(deriveAuthority(seed, 0, 'mint', 1).pub),
    };
    expect(scanAuthorities(derivePub, [stranger])).toEqual({ highest: -1, held: [] });
    const found = scanAuthorities(derivePub, [
      stranger,
      row('aa'.repeat(32), 0),
      row('bb'.repeat(32), 15, { melt: false }),
    ]);
    expect(found.highest).toBe(15);
    expect(found.held).toEqual([
      { tokenId: 'aa'.repeat(32), nonce: 0, mint: true, melt: true },
      { tokenId: 'bb'.repeat(32), nonce: 15, mint: true, melt: false },
    ]);
    // Past the gap from the last match, a token is out of reach.
    const far = scanAuthorities(derivePub, [row('cc'.repeat(32), AUTHORITY_GAP)]);
    expect(far.highest).toBe(-1);
  });

  it('can\'t be scanned when the registry withholds a key', () => {
    const withheld = {
      token_id: 'dd'.repeat(32),
      has_mint_authority: true,
      has_melt_authority: false,
    };
    expect(() => scanAuthorities(derivePub, [withheld])).toThrow(AuthoritiesWithheldError);
  });

  it('take a nonce past everything known taken, and never one a scan can\'t find again', () => {
    expect(nextNonce({ highest: -1, reserved: [], signedFloor: null })).toBe(0);
    expect(nextNonce({ highest: 4, reserved: [], signedFloor: null })).toBe(5);
    expect(nextNonce({ highest: 4, reserved: [5, 7], signedFloor: null })).toBe(8);
    expect(nextNonce({ highest: 4, reserved: [], signedFloor: 9 })).toBe(10);
    expect(nextNonce({ highest: -1, reserved: [18], signedFloor: null })).toBe(19);
    expect(() => nextNonce({ highest: -1, reserved: [19], signedFloor: null }))
      .toThrow(NonceBeyondReachError);
  });
});
