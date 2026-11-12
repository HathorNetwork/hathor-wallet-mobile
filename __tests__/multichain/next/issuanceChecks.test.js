/**
 * Copyright (c) Hathor Labs and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { describe, it, expect } from '@jest/globals';
import { RistrettoPoint } from '@noble/curves/ed25519';
import { utf8ToBytes } from '@noble/hashes/utils';
import vectors from './fixtures/remote-issuance.json';
import paymentVectors from './fixtures/remote-signing.json';
import authorityVectors from './fixtures/token-authority.json';
import { SignRefusedError, checkCreateRequest } from '../../../src/multichain/next/signer';
import { parseIssuanceTx, signingHashOf } from '../../../src/multichain/next/kit/tx';
import { readTxV3 } from '../../../src/multichain/next/kit/txV3';
import { rangeProofLen } from '../../../src/multichain/next/kit/txV2';
import { EXCESS_DOMAIN } from '../../../src/multichain/next/kit/inputSig';
import { hashToScalar } from '../../../src/multichain/next/kit/hash';
import {
  CREATED_TOKEN_ID,
  assetGenerator,
  checkOpeningLevels,
  expectedOutput,
} from '../../../src/multichain/next/kit/opening';
import { decodeAddressKeys, encodeAddress } from '../../../src/multichain/next/kit/address';
import { publicKeyOf } from '../../../src/multichain/next/kit/keys';
import {
  AuthoritiesWithheldError,
  RegistryUnreadableError,
  deriveAuthority,
  scanAuthorities,
} from '../../../src/multichain/next/kit/authority';
import {
  bigintToBytesLE,
  bytesToBigintLE,
  bytesToHex,
  concatBytes,
  hexToBytes,
  modOrder,
  scalarFromCanonical,
  u64LE,
} from '../../../src/multichain/next/kit/scalar';

// Each check on its own: every case below breaks only what one check guards, and the refusal must
// name that check, so no other check can stand in for it. Breaking any one of these checks in the
// code makes its case fail.

const NATIVE = vectors.native_token;
const CREATED = bytesToHex(CREATED_TOKEN_ID);
const PUBLIC = vectors.cases.find((c) => c.name === 'token-create from public funds');
const HIDDEN = vectors.cases.find((c) => c.name === 'token-create from hidden funds');
const MINT = vectors.cases.find((c) => c.kind === 'mint');
const NOW = 1788000000;
const OWN = encodeAddress(PUBLIC.pub_a, PUBLIC.pub_b);
const R = scalarFromCanonical(hexToBytes(PUBLIC.sender_opening));
const OTHER_TOKEN = 'ab'.repeat(32);

const refusal = (fn) => {
  try {
    fn();
  } catch (e) {
    return e;
  }
  return null;
};

const changed = (bytes) => {
  const out = Uint8Array.from(bytes);
  out[0] = (out[0] + 1) % 256;
  return out;
};

const u32LE = (n) => {
  const out = new Uint8Array(4);
  new DataView(out.buffer).setUint32(0, n, true);
  return out;
};

function contextOf(vector, intent = {}) {
  const { approved } = vector;
  return {
    b: bytesToBigintLE(hexToBytes(vector.b)),
    pubB: hexToBytes(vector.pub_b),
    intent: {
      symbol: approved.symbol,
      name: approved.name,
      amount: BigInt(approved.amount),
      mintAuthority: hexToBytes(approved.mint_authority),
      meltAuthority: hexToBytes(approved.melt_authority),
      ...intent,
    },
    nativeTokenId: NATIVE,
    serviceViewPub: vector.pub_a,
    maxFee: BigInt(approved.max_fee),
    nowS: NOW,
  };
}

function requestOf(vector, patch = {}) {
  return {
    id: 'send-1',
    unsigned_tx: vector.unsigned_tx,
    sender_opening: vector.sender_opening,
    inputs: vector.inputs,
    outputs: vector.outputs,
    fee: vector.fee,
    expires_at: 4000000000,
    issuance: { kind: 'token-create' },
    ...patch,
  };
}

const refusedFor = (request, context = contextOf(PUBLIC)) => {
  const e = refusal(() => checkCreateRequest(request, context));
  expect(e).toBeInstanceOf(SignRefusedError);
  return e.message;
};

/**
 * Output `index` paying `amount` of `token` to `address` at `level`, as the protocol writes it:
 * declared (levels 1 to 3) pays the spend key itself, level 4 a one-time key.
 */
function honest(form, { address, token, amount, index, level, tokenIndex, }) {
  const want = expectedOutput(R, address, hexToBytes(token), amount, index, 8);
  const keys = decodeAddressKeys(address);
  const oneTimeKey = level < 4 ? keys.spend : want.oneTimeKey;
  if (form === 'transparent') {
    return {
      form, oneTimeKey, viewTag: want.viewTag, tokenIndex, amount,
    };
  }
  if (form === 'amount-shielded') {
    const shared = RistrettoPoint.fromHex(keys.view).multiply(R).toRawBytes();
    const blinder = hashToScalar('samba/blind', [shared, u32LE(index)]);
    const commitment = assetGenerator(hexToBytes(token)).multiply(amount)
      .add(RistrettoPoint.BASE.multiply(blinder));
    return {
      form,
      oneTimeKey,
      viewTag: want.viewTag,
      tokenIndex,
      commitment: commitment.toRawBytes(),
      memo: want.memo,
    };
  }
  return {
    form,
    oneTimeKey,
    viewTag: want.viewTag,
    assetTag: want.assetTag,
    commitment: want.commitment,
    memo: want.memo,
  };
}

// A u64 token creation written field by field, as kit/txV3.js reads it. The proofs only the
// network checks are zeros, so a test transaction fails only the check under test. With an excess,
// it is signed with a key the test holds: the app checks that signature, not that amounts balance.
const FORGER = 777n;
function creationBytes({
  fee,
  feeToken = 255,
  table = [],
  inputs,
  outputs,
  definition,
  excess = false,
}) {
  const of = (form) => outputs.filter((o) => o.form === form);
  const [shielded, amountShielded, transparent] = ['shielded', 'amount-shielded', 'transparent'].map(of);
  const committed = shielded.length + amountShielded.length;
  const parts = [
    Uint8Array.of(
      0x40,
      excess ? 0 : 1,
      1,
      inputs.length,
      shielded.length,
      amountShielded.length,
      transparent.length
    ),
    publicKeyOf(R),
    Uint8Array.of(feeToken),
    u64LE(fee),
    Uint8Array.of(table.length),
    ...table.map(hexToBytes),
    ...inputs.map((g) => u64LE(g)),
  ];
  for (const o of shielded) {
    parts.push(
      o.oneTimeKey,
      o.assetTag,
      o.commitment,
      new Uint8Array(32),
      Uint8Array.of(o.viewTag),
      o.memo
    );
  }
  for (const o of amountShielded) {
    parts.push(
      o.oneTimeKey,
      Uint8Array.of(o.viewTag, o.tokenIndex),
      o.commitment,
      new Uint8Array(32),
      o.memo
    );
  }
  for (const o of transparent) {
    parts.push(o.oneTimeKey, Uint8Array.of(o.viewTag, o.tokenIndex), u64LE(o.amount));
  }
  if (excess) {
    parts.push(publicKeyOf(FORGER));
  }
  const symbol = utf8ToBytes(definition.symbol);
  const name = utf8ToBytes(definition.name);
  parts.push(
    Uint8Array.of(symbol.length, name.length, 3),
    symbol,
    name,
    definition.mint,
    definition.melt,
    new Uint8Array(64 * inputs.length),
    new Uint8Array(160 * committed),
    new Uint8Array((36 + 32 * inputs.length) * shielded.length),
    new Uint8Array(committed > 0 ? rangeProofLen(false, committed) : 0),
    new Uint8Array(excess ? 64 : 0),
  );
  const bytes = concatBytes(...parts);
  if (excess) {
    const tx = readTxV3(bytes);
    const msg = signingHashOf(bytes, tx);
    const k = 4242n;
    const point = publicKeyOf(FORGER);
    const e = hashToScalar(EXCESS_DOMAIN, [point, publicKeyOf(k), msg]);
    bytes.set(
      concatBytes(publicKeyOf(k), bigintToBytesLE(modOrder(k + e * FORGER))),
      tx.excess.signatureOffset,
    );
  }
  return bytesToHex(bytes);
}

const DEFINITION = {
  symbol: PUBLIC.approved.symbol,
  name: PUBLIC.approved.name,
  mint: hexToBytes(PUBLIC.approved.mint_authority),
  melt: hexToBytes(PUBLIC.approved.melt_authority),
};

// The public-funds creation's claims: its supply and its change, both transparent, in its order.
const CLAIMS = PUBLIC.outputs.map((o) => ({
  address: o.address,
  token: o.token,
  amount: BigInt(o.amount),
  is_change: o.is_change,
  form: 'transparent',
  level: 1,
}));

/** The creation request for these outputs (in the reader's order), each written honestly. */
function forged(outputs, { table = [], feeToken = 255, excess = false } = {}) {
  const written = outputs.map((o, index) => honest(o.form, {
    ...o,
    index,
    tokenIndex: o.tokenIndex ?? (o.token === CREATED ? 254 : 255),
  }));
  return requestOf(PUBLIC, {
    unsigned_tx: creationBytes({
      fee: BigInt(PUBLIC.fee),
      feeToken,
      table,
      inputs: PUBLIC.inputs.map((i) => BigInt(i.global_index)),
      outputs: written,
      definition: DEFINITION,
      excess,
    }),
    outputs: outputs.map((o) => ({
      address: o.address, token: o.token, amount: String(o.amount), is_change: o.is_change,
    })),
  });
}

describe('a token creation written by the tests', () => {
  it('is byte for byte the vector, when it writes the vector\'s creation', () => {
    expect(forged(CLAIMS).unsigned_tx).toBe(PUBLIC.unsigned_tx);
    expect(refusal(() => checkCreateRequest(forged(CLAIMS), contextOf(PUBLIC)))).toBeNull();
  });
});

describe('each check of a token creation, on its own', () => {
  const CHANGE_AT = CLAIMS.findIndex((o) => o.is_change);
  const withChange = (patch) => CLAIMS.map((o, i) => (i === CHANGE_AT ? { ...o, ...patch } : o));

  it('refuses a request past its time, or with none', () => {
    for (const expiresAt of [NOW, undefined]) {
      expect(refusedFor(requestOf(PUBLIC, { expires_at: expiresAt })))
        .toBe('The token creation expired before it was signed.');
    }
  });

  it('refuses, as a refusal, bytes it can\'t read', () => {
    expect(refusedFor(requestOf(PUBLIC, { unsigned_tx: 'zz' })))
      .toMatch(/^The transaction can't be read/);
  });

  it('refuses a mint\'s bytes called a creation, and a creation called something else', () => {
    expect(refusedFor(requestOf(MINT))).toBe('The transaction is not a token creation.');
    for (const issuance of [{ kind: 'mint' }, undefined]) {
      expect(refusedFor(requestOf(PUBLIC, { issuance })))
        .toBe('The transaction is not a token creation.');
    }
  });

  it('refuses a broken excess signature', () => {
    const bytes = hexToBytes(HIDDEN.unsigned_tx);
    const at = parseIssuanceTx(bytes).excess.signatureOffset + 40;
    bytes.set(Uint8Array.of((bytes[at] + 1) % 256), at);
    expect(refusedFor(requestOf(HIDDEN, { unsigned_tx: bytesToHex(bytes) }), contextOf(HIDDEN)))
      .toBe('The transaction\'s excess signature is wrong.');
  });

  it('refuses a fee in another token than the native one', () => {
    expect(refusedFor(forged(CLAIMS, { feeToken: 0, table: [OTHER_TOKEN] })))
      .toBe('The fee is not paid in the native token.');
  });

  it('refuses a fee other than the quoted one, or above what the user agreed to', () => {
    const fee = BigInt(PUBLIC.fee);
    expect(refusedFor(requestOf(PUBLIC, { fee: String(fee - 1n) })))
      .toBe('The fee is not the one the user agreed to.');
    const context = contextOf(PUBLIC);
    expect(refusedFor(requestOf(PUBLIC), { ...context, maxFee: fee - 1n }))
      .toBe('The fee is not the one the user agreed to.');
  });

  it.each([
    ['symbol', { symbol: 'USDT' }, 'The token is not the one the user approved.'],
    ['name', { name: 'Samba Dollaz' }, 'The token is not the one the user approved.'],
    ['mint key', { mintAuthority: publicKeyOf(5n) }, 'The token\'s mint or melt key is not this wallet\'s.'],
    ['melt key', { meltAuthority: publicKeyOf(5n) }, 'The token\'s mint or melt key is not this wallet\'s.'],
  ])('refuses a body with another %s than the approved one', (name, intent, message) => {
    expect(refusedFor(requestOf(PUBLIC), contextOf(PUBLIC, intent))).toBe(message);
  });

  it('refuses an output that is not transparent, though the excess holds', () => {
    // The change made amount-shielded (level 2, still this wallet's), written first as the
    // reader orders kinds.
    const change = { ...CLAIMS[CHANGE_AT], form: 'amount-shielded', level: 2 };
    const outputs = [change, ...CLAIMS.filter((o) => !o.is_change)];
    expect(refusedFor(forged(outputs, { excess: true })))
      .toBe('A token creation\'s outputs are transparent.');
  });

  it('refuses claims the bytes don\'t pay, even when they are what the user approved', () => {
    const supplyAt = CLAIMS.findIndex((o) => !o.is_change);
    const more = BigInt(PUBLIC.approved.amount) + 1n;
    const outputs = PUBLIC.outputs.map((o, i) => (
      i === supplyAt ? { ...o, amount: String(more) } : o
    ));
    expect(refusedFor(requestOf(PUBLIC, { outputs }), contextOf(PUBLIC, { amount: more })))
      .toMatch(/^The outputs don't open/);
  });

  it('refuses change to another wallet, or to this spend key under another view key', () => {
    const elsewhere = [
      encodeAddress(PUBLIC.pub_a, bytesToHex(publicKeyOf(6n))),
      encodeAddress(bytesToHex(publicKeyOf(9n)), PUBLIC.pub_b),
    ];
    for (const address of elsewhere) {
      expect(refusedFor(forged(withChange({ address }))))
        .toBe('An output of the token creation pays another wallet.');
    }
  });

  it('refuses change in a token that is neither the created one nor the native one', () => {
    const outputs = withChange({ token: OTHER_TOKEN, tokenIndex: 0 });
    expect(refusedFor(forged(outputs, { table: [OTHER_TOKEN] })))
      .toBe('An output of the token creation is in an unexpected token.');
  });

  it('refuses a supply other than the approved amount, though every output opens', () => {
    const less = BigInt(PUBLIC.approved.amount) - 1n;
    expect(refusedFor(requestOf(PUBLIC), contextOf(PUBLIC, { amount: less })))
      .toBe('The token\'s supply is not the amount the user approved.');
  });
});

describe('each check of the opening at an approved level, on its own', () => {
  const NATIVE_BYTES = hexToBytes(NATIVE);
  const SPECS = [
    {
      form: 'transparent', level: 1, token: NATIVE, tokenIndex: 255,
    },
    {
      form: 'amount-shielded', level: 2, token: OTHER_TOKEN, tokenIndex: 0,
    },
    { form: 'shielded', level: 3, token: OTHER_TOKEN },
    { form: 'shielded', level: 4, token: OTHER_TOKEN },
  ];
  const FIELDS = {
    transparent: ['oneTimeKey', 'viewTag', 'tokenIndex', 'amount'],
    'amount-shielded': ['oneTimeKey', 'viewTag', 'tokenIndex', 'commitment', 'memo'],
    shielded: ['oneTimeKey', 'viewTag', 'assetTag', 'commitment', 'memo'],
  };
  const AMOUNT = 1000n;

  describe.each(SPECS)('a $form output at level $level', (spec) => {
    const output = honest(spec.form, {
      ...spec, address: OWN, amount: AMOUNT, index: 0,
    });
    const txOf = (outputs) => ({
      kind: 'token-create',
      width: 'u64',
      rPub: publicKeyOf(R),
      table: [hexToBytes(OTHER_TOKEN)],
      outputs,
    });
    const recipient = {
      address: OWN, amount: AMOUNT, tokenId: hexToBytes(spec.token), level: spec.level,
    };
    const open = (recipients, key = bigintToBytesLE(R), outputs = [output]) => (
      () => checkOpeningLevels(txOf(outputs), recipients, key, NATIVE_BYTES)
    );

    it('opens, as written', () => {
      expect(open([recipient])).not.toThrow();
    });

    it('needs exactly one recipient per output', () => {
      expect(open([recipient, recipient])).toThrow('Every output needs a recipient.');
      expect(open([])).toThrow('Every output needs a recipient.');
    });

    it('needs the transaction\'s own key, never zero', () => {
      for (const key of [new Uint8Array(32), bigintToBytesLE(modOrder(R + 1n))]) {
        expect(open([recipient], key)).toThrow('The opening is not this transaction\'s key.');
      }
    });

    it('needs a level from 1 to 4', () => {
      for (const level of [0, 5, undefined]) {
        expect(open([{ ...recipient, level }])).toThrow('Output 0 has no level.');
      }
    });

    it('refuses an amount out of range, whose commitment could alias', () => {
      for (const amount of [-1n, 2n ** 64n]) {
        expect(open([{ ...recipient, amount }])).toThrow('Output 0 pays an amount out of range.');
      }
    });

    it.each(FIELDS[spec.form])('refuses an output whose %s is not the one its recipient gets', (field) => {
      let value;
      if (field === 'viewTag') {
        value = (output.viewTag + 1) % 256;
      } else if (field === 'tokenIndex') {
        value = output.tokenIndex === 255 ? 0 : 255;
      } else if (field === 'amount') {
        value = output.amount + 1n;
      } else {
        value = changed(output[field]);
      }
      expect(open([recipient], undefined, [{ ...output, [field]: value }]))
        .toThrow('Output 0 doesn\'t pay what it says.');
    });

    if (spec.form !== 'shielded') {
      it('refuses a token index the transaction doesn\'t list', () => {
        expect(open([recipient], undefined, [{ ...output, tokenIndex: 7 }]))
          .toThrow('An output names a token the transaction doesn\'t list.');
      });
    }
  });
});

describe('the opening at an approved level, with a transaction keyed by the identity', () => {
  it('never opens with a zero key: every shared secret would be the identity', () => {
    const recipient = {
      address: OWN, amount: 1000n, tokenId: hexToBytes(NATIVE), level: 1,
    };
    const want = expectedOutput(0n, OWN, hexToBytes(NATIVE), 1000n, 0, 8);
    const output = {
      form: 'transparent',
      oneTimeKey: decodeAddressKeys(OWN).spend,
      viewTag: want.viewTag,
      tokenIndex: 255,
      amount: 1000n,
    };
    const tx = {
      kind: 'token-create', width: 'u64', rPub: new Uint8Array(32), table: [], outputs: [output],
    };
    expect(() => checkOpeningLevels(tx, [recipient], new Uint8Array(32), hexToBytes(NATIVE)))
      .toThrow('The opening is not this transaction\'s key.');
  });
});

describe('the issuance reader', () => {
  it('reads no payment as an issuance', () => {
    for (const vector of paymentVectors.cases) {
      expect(() => parseIssuanceTx(hexToBytes(vector.unsigned_tx)))
        .toThrow('Not a transaction this wallet signs.');
    }
  });
});

describe('each check of the registry scan and the authorities, on its own', () => {
  const seed = hexToBytes(authorityVectors.seed64_hex);
  const derivePub = (kind, nonce) => deriveAuthority(seed, 3, kind, nonce).pub;
  const row = (patch = {}) => ({
    token_id: 'aa'.repeat(32),
    has_mint_authority: true,
    has_melt_authority: true,
    mint_authority: bytesToHex(publicKeyOf(11n)),
    melt_authority: bytesToHex(publicKeyOf(12n)),
    ...patch,
  });

  it('reads a registry of well-formed rows', () => {
    expect(scanAuthorities(derivePub, [row()])).toEqual({ highest: -1, held: [] });
  });

  it.each([
    ['not a list', { tokens: [] }],
    ['a missing row', [null]],
    ['a token id that is not one', [row({ token_id: 'zz' })]],
    ['no token id', [row({ token_id: undefined })]],
    ['a mint flag that is not a boolean', [row({ has_mint_authority: 'true' })]],
    ['a melt flag that is not a boolean', [row({ has_melt_authority: 1 })]],
  ])('can\'t be read with %s', (name, registry) => {
    expect(() => scanAuthorities(derivePub, registry)).toThrow(RegistryUnreadableError);
  });

  it.each([
    ['mint', row({ mint_authority: undefined })],
    ['melt', row({ melt_authority: undefined })],
  ])('can\'t be scanned when the registry withholds a %s key', (name, withheld) => {
    expect(() => scanAuthorities(derivePub, [withheld])).toThrow(AuthoritiesWithheldError);
  });

  it('takes a nonce whose melt key sits in a mint slot, but holds no power there', () => {
    const misplaced = row({
      has_melt_authority: false,
      melt_authority: undefined,
      mint_authority: bytesToHex(derivePub('melt', 0)),
    });
    expect(scanAuthorities(derivePub, [misplaced])).toEqual({ highest: 0, held: [] });
  });

  it('derives only a mint or a melt authority, at a whole nonce from 0', () => {
    expect(() => deriveAuthority(seed, 3, 'burn', 0)).toThrow('An authority is a mint or a melt one.');
    for (const nonce of [-1, 1.5, Number.NaN, 2 ** 53]) {
      expect(() => deriveAuthority(seed, 3, 'mint', nonce)).toThrow('The nonce is out of range.');
    }
  });
});
