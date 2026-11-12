/**
 * Copyright (c) Hathor Labs and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { describe, it, expect } from '@jest/globals';
import {
  Address,
  CreateTokenTransaction,
  FeeHeader,
  Input,
  Network,
  Output,
  P2PKH,
  Transaction,
} from '@hathor/wallet-lib';
import {
  BURN_DATA_VALUE,
  checkBurn,
  dataScriptPayload,
  inputDataOf,
  parseBurnPayload,
} from '../../../src/multichain/next/burnCheck';
import { SignRefusedError } from '../../../src/multichain/next/signer';
import { encodeAddress } from '../../../src/multichain/next/kit/address';
import { publicKeyOf } from '../../../src/multichain/next/kit/keys';
import { bytesToHex, concatBytes, hexToBytes } from '../../../src/multichain/next/kit/scalar';

const network = new Network('privatenet');
const TRANSFER = 'WScTqhLsBQnz3HMdQqh66JBgWqb255XffL';
const CHANGE = 'WXkMhVgRVmTXTVh47wauPKm1xcrW8Qf3Vb';
const DEST_NETWORK = 'd5'.repeat(32);
const VIEW = bytesToHex(publicKeyOf(7n));
const SPEND = bytesToHex(publicKeyOf(11n));
const NEXT_ADDRESS = encodeAddress(VIEW, SPEND);
const UTXOS = [
  { txId: '01'.repeat(32), index: 0, value: 600n },
  { txId: '02'.repeat(32), index: 3, value: 400n },
];

function payload({ dest = DEST_NETWORK, view = VIEW, spend = SPEND, version = 1 } = {}) {
  return concatBytes(
    Uint8Array.of(0x43, 0x54, version),
    hexToBytes(dest),
    hexToBytes(view),
    hexToBytes(spend),
  );
}

function dataScript(bytes) {
  return Buffer.from(concatBytes(Uint8Array.of(0x4c, bytes.length), bytes, Uint8Array.of(0xac)));
}

const p2pkh = (address) => new Address(address, { network }).getScript();

function burnHex({
  outputs = null,
  inputs = UTXOS,
  amount = 700n,
  change = 299n,
  data = payload(),
  version = 1,
  tokens = [],
  headers = [],
} = {}) {
  const outs = outputs ?? [
    new Output(BURN_DATA_VALUE, dataScript(data)),
    new Output(amount, p2pkh(TRANSFER)),
    ...(change ? [new Output(change, p2pkh(CHANGE))] : []),
  ];
  const tx = new Transaction(inputs.map((u) => new Input(u.txId, u.index)), outs, {
    version,
    tokens,
    headers,
    timestamp: 1790000000,
    parents: ['aa'.repeat(32), 'bb'.repeat(32)],
    weight: 1,
    nonce: 0,
  });
  return tx.toHex();
}

const expected = {
  network,
  utxos: UTXOS,
  amount: 700n,
  transferAddress: TRANSFER,
  changeAddress: CHANGE,
  destinationNetwork: DEST_NETWORK,
  destination: NEXT_ADDRESS,
};

const refusal = (fn) => {
  try {
    fn();
  } catch (e) {
    return e;
  }
  return null;
};

describe('the burn payload', () => {
  it('reads "CT" ‖ 1 ‖ dest_network ‖ A ‖ B from a data script', () => {
    const script = dataScript(payload());
    expect(parseBurnPayload(dataScriptPayload(script))).toEqual({
      destinationNetwork: DEST_NETWORK,
      view: VIEW,
      spend: SPEND,
    });
    expect(parseBurnPayload(payload({ version: 2 }))).toBeNull();
    expect(dataScriptPayload(Uint8Array.from([0x4c, 3, 1, 2, 0xac]))).toBeNull();
  });
});

describe('checking a burn before signing it', () => {
  it('passes the burn that moves the chosen HTR to this wallet on Hathor Next', () => {
    const tx = checkBurn(burnHex(), expected);
    expect(tx.inputs).toHaveLength(2);
  });

  it('reads the burn on Hermes, whose subarray hands back a plain Uint8Array', () => {
    // Hermes ignores Symbol.species, so under the app's buffer@4 polyfill a Buffer's subarray has
    // none of the readers wallet-lib's parser calls ("undefined is not a function" on a device).
    const hex = burnHex();
    const own = Object.getOwnPropertyDescriptor(Buffer.prototype, 'subarray');
    Buffer.prototype.subarray = function hermesSubarray(start, end) {
      return new Uint8Array(this.buffer, this.byteOffset, this.length).subarray(start, end);
    };
    try {
      expect(checkBurn(hex, expected).inputs).toHaveLength(2);
      // The polyfill's own subarray is back once the burn is read.
      expect(Buffer.from([1, 2]).subarray(1)).not.toBeInstanceOf(Buffer);
    } finally {
      if (own) {
        Object.defineProperty(Buffer.prototype, 'subarray', own);
      } else {
        delete Buffer.prototype.subarray;
      }
    }
  });

  it('passes an exact spend with no change', () => {
    expect(() => checkBurn(burnHex({ change: 0n, amount: 999n }), {
      ...expected,
      amount: 999n,
      changeAddress: null,
    })).not.toThrow();
  });

  it('passes a burn to anyone\'s Hathor Next address, when that is the one chosen', () => {
    const view = bytesToHex(publicKeyOf(13n));
    const spend = bytesToHex(publicKeyOf(17n));
    const theirs = { ...expected, destination: encodeAddress(view, spend) };
    expect(() => checkBurn(burnHex({ data: payload({ view, spend }) }), theirs)).not.toThrow();
    // The backend can't send it elsewhere: not even to this wallet's own address.
    expect(refusal(() => checkBurn(burnHex(), theirs))).toBeInstanceOf(SignRefusedError);
  });

  it('refuses a burn when the chosen address can\'t be read', () => {
    const unreadable = { ...expected, destination: NEXT_ADDRESS.slice(0, -1) };
    expect(refusal(() => checkBurn(burnHex(), unreadable))).toBeInstanceOf(SignRefusedError);
  });

  it.each([
    ['another Hathor Next network', { data: payload({ dest: '00'.repeat(32) }) }],
    ['another Hathor Next address', { data: payload({ spend: bytesToHex(publicKeyOf(12n)) }) }],
    ['another amount', { amount: 600n, change: 399n }],
    ['other inputs', { inputs: [UTXOS[0], { ...UTXOS[1], index: 4 }] }],
  ])('refuses a burn to %s', (name, patch) => {
    expect(refusal(() => checkBurn(burnHex(patch), expected))).toBeInstanceOf(SignRefusedError);
  });

  it('refuses a burn whose data output is not first, or that pays anyone else', () => {
    const data = new Output(BURN_DATA_VALUE, dataScript(payload()));
    const transfer = new Output(700n, p2pkh(TRANSFER));
    const change = new Output(299n, p2pkh(CHANGE));
    const stranger = new Output(299n, p2pkh(TRANSFER));
    for (const outputs of [[transfer, data, change], [data, transfer, stranger]]) {
      expect(refusal(() => checkBurn(burnHex({ outputs }), expected)))
        .toBeInstanceOf(SignRefusedError);
    }
  });

  it('refuses a timelock on the transfer or the change, which would hold the HTR', () => {
    const timelocked = (address) => new P2PKH(new Address(address, { network }), {
      timelock: 4000000000,
    }).createScript();
    // Refused for the timelock itself: the script is the plain one plus the lock.
    expect(bytesToHex(timelocked(TRANSFER))).not.toBe(bytesToHex(p2pkh(TRANSFER)));
    expect(bytesToHex(timelocked(TRANSFER))).toContain(bytesToHex(p2pkh(TRANSFER)));
    const data = new Output(BURN_DATA_VALUE, dataScript(payload()));
    const transfer = new Output(700n, p2pkh(TRANSFER));
    const change = new Output(299n, p2pkh(CHANGE));
    for (const outputs of [
      [data, new Output(700n, timelocked(TRANSFER)), change],
      [data, transfer, new Output(299n, timelocked(CHANGE))],
    ]) {
      expect(refusal(() => checkBurn(burnHex({ outputs }), expected)))
        .toBeInstanceOf(SignRefusedError);
    }
  });

  it('refuses a burn that takes a fee nobody agreed to', () => {
    expect(refusal(() => checkBurn(burnHex({ change: 298n }), expected)))
      .toBeInstanceOf(SignRefusedError);
  });
});

describe('the burn\'s shape', () => {
  it.each([
    ['another version', { version: 2 }],
    ['a token list', { tokens: ['cc'.repeat(32)] }],
    ['a header, which the inputs would sign', { headers: [new FeeHeader([{ tokenIndex: 0, amount: 1n }])] }],
  ])('refuses a burn with %s', (name, patch) => {
    expect(refusal(() => checkBurn(burnHex(patch), expected))).toBeInstanceOf(SignRefusedError);
  });

  it('refuses a transfer address that is not the chain transfer\'s, whoever names it', () => {
    // A spendable address of the backend's, not the chain transfer's.
    const own = 'WY1URKUnqCTyiixW1Dw29vmeG99hNN4EW6';
    const outputs = [
      new Output(BURN_DATA_VALUE, dataScript(payload())),
      new Output(700n, p2pkh(own)),
      new Output(299n, p2pkh(CHANGE)),
    ];
    const pinnedElsewhere = { ...expected, transferAddress: own };
    expect(refusal(() => checkBurn(burnHex({ outputs }), pinnedElsewhere)))
      .toBeInstanceOf(SignRefusedError);
  });
});

// Each check on its own: every burn below breaks only what one check guards, and the refusal must
// name that check, so no other check can stand in for it.
describe('each check of the burn, on its own', () => {
  const REFUSED = {
    unreadable: /^The burn can't be read/,
    shape: 'The burn is not a plain transaction.',
    inputs: 'The burn spends other outputs than the ones this wallet chose.',
    data: 'The burn doesn\'t start with its data output.',
    destination: 'The burn sends the HTR somewhere else than the chosen Hathor Next address.',
    outputs: 'The burn pays other outputs than the transfer and the change.',
    token: 'The burn moves another token than HTR.',
    amount: 'The burn moves another amount than the one chosen.',
    sum: 'The burn\'s inputs and outputs don\'t add up.',
  };
  const refusedFor = (hex, exp = expected) => {
    const e = refusal(() => checkBurn(hex, exp));
    expect(e).toBeInstanceOf(SignRefusedError);
    return e.message;
  };
  const data = (value = BURN_DATA_VALUE, script = dataScript(payload()), tokenData = 0) => (
    new Output(value, script, { tokenData })
  );
  const transfer = (value = 700n, tokenData = 0) => (
    new Output(value, p2pkh(TRANSFER), { tokenData })
  );
  const change = (value = 299n) => new Output(value, p2pkh(CHANGE));
  // A spendable address that is neither the transfer's nor this wallet's change.
  const STRANGER = 'WY1URKUnqCTyiixW1Dw29vmeG99hNN4EW6';

  it('passes the burn the cases below each change in one place', () => {
    expect(() => checkBurn(burnHex({ outputs: [data(), transfer(), change()] }), expected))
      .not.toThrow();
  });

  it('refuses bytes that are not a transaction', () => {
    for (const hex of ['zz', burnHex().slice(0, -8)]) {
      expect(refusedFor(hex)).toMatch(REFUSED.unreadable);
    }
  });

  it('refuses a token creation, though it lists no token and has no header', () => {
    const creation = new CreateTokenTransaction(
      'Token',
      'TKN',
      UTXOS.map((u) => new Input(u.txId, u.index)),
      [data(), transfer(), change()],
      { timestamp: 1790000000, parents: ['aa'.repeat(32), 'bb'.repeat(32)], weight: 1, nonce: 0 },
    );
    expect(refusedFor(creation.toHex())).toBe(REFUSED.shape);
  });

  it('refuses a burn that leaves out one of the chosen inputs', () => {
    expect(refusedFor(burnHex({ inputs: [UTXOS[0]] }))).toBe(REFUSED.inputs);
  });

  it('refuses a burn that spends one chosen input twice', () => {
    expect(refusedFor(burnHex({ inputs: [UTXOS[0], UTXOS[0]] }))).toBe(REFUSED.inputs);
  });

  it('refuses a burn with no output', () => {
    expect(refusedFor(burnHex({ outputs: [] }))).toBe(REFUSED.data);
  });

  it('refuses a data output of another value, though the rest adds up', () => {
    expect(refusedFor(burnHex({ outputs: [data(2n), transfer(), change()] }))).toBe(REFUSED.data);
  });

  it('refuses a data output that is an authority', () => {
    const outputs = [data(BURN_DATA_VALUE, dataScript(payload()), 0x80), transfer(), change()];
    expect(refusedFor(burnHex({ outputs }))).toBe(REFUSED.data);
  });

  it('refuses a first output that carries no payload', () => {
    const outputs = [data(BURN_DATA_VALUE, p2pkh(CHANGE)), transfer(), change()];
    expect(refusedFor(burnHex({ outputs }))).toBe(REFUSED.destination);
  });

  it('refuses a payload naming another view key with the chosen spend key', () => {
    const outputs = [
      data(BURN_DATA_VALUE, dataScript(payload({ view: bytesToHex(publicKeyOf(8n)) }))),
      transfer(),
      change(),
    ];
    expect(refusedFor(burnHex({ outputs }))).toBe(REFUSED.destination);
  });

  it('refuses a burn with no transfer output', () => {
    expect(refusedFor(burnHex({ outputs: [data(), change(999n)] }))).toBe(REFUSED.outputs);
  });

  it('refuses the amount split over two transfer outputs', () => {
    const outputs = [data(), transfer(350n), transfer(350n), change()];
    expect(refusedFor(burnHex({ outputs }))).toBe(REFUSED.outputs);
  });

  it('refuses the change split over two outputs', () => {
    const outputs = [data(), transfer(), change(150n), change(149n)];
    expect(refusedFor(burnHex({ outputs }))).toBe(REFUSED.outputs);
  });

  it('refuses an output to anyone else, with the change cut to pay it', () => {
    const outputs = [data(), transfer(), change(200n), new Output(99n, p2pkh(STRANGER))];
    expect(refusedFor(burnHex({ outputs }))).toBe(REFUSED.outputs);
  });

  it('refuses a transfer output that is an authority', () => {
    expect(refusedFor(burnHex({ outputs: [data(), transfer(700n, 0x80), change()] })))
      .toBe(REFUSED.token);
  });

  it('refuses a transfer of another amount, though the change makes it add up', () => {
    // 1000 in: 1 + 600 + 299 out, the amount chosen 700. Only the amount check sees it.
    expect(refusedFor(burnHex({ outputs: [data(), transfer(600n), change()] })))
      .toBe(REFUSED.amount);
  });

  it('refuses outputs that spend more than the inputs hold', () => {
    expect(refusedFor(burnHex({ change: 300n }))).toBe(REFUSED.sum);
  });
});

describe('the data script, read as hathor-core reads it', () => {
  const PAYLOAD = payload();

  it('reads a push of the payload followed by OP_CHECKSIG, short or with OP_PUSHDATA1', () => {
    const short = concatBytes(Uint8Array.of(4), Uint8Array.of(1, 2, 3, 4), Uint8Array.of(0xac));
    expect(bytesToHex(dataScriptPayload(short))).toBe('01020304');
    expect(bytesToHex(dataScriptPayload(dataScript(PAYLOAD)))).toBe(bytesToHex(PAYLOAD));
  });

  it.each([
    ['empty', new Uint8Array(0)],
    ['OP_CHECKSIG alone', Uint8Array.of(0xac)],
    ['another last opcode', concatBytes(Uint8Array.of(0x4c, PAYLOAD.length), PAYLOAD, Uint8Array.of(0xab))],
    ['OP_PUSHDATA2 read as OP_PUSHDATA1', concatBytes(Uint8Array.of(0x4d, PAYLOAD.length), PAYLOAD, Uint8Array.of(0xac))],
    ['a byte between the push and OP_CHECKSIG', concatBytes(Uint8Array.of(0x4c, PAYLOAD.length), PAYLOAD, Uint8Array.of(0x00, 0xac))],
  ])('reads no payload from %s', (name, script) => {
    expect(dataScriptPayload(script)).toBeNull();
  });

  it.each([
    ['one byte too many', concatBytes(PAYLOAD, Uint8Array.of(0))],
    ['one byte too few', PAYLOAD.slice(0, -1)],
    ['another first letter', concatBytes(Uint8Array.of(0x58), PAYLOAD.slice(1))],
    ['another second letter', concatBytes(Uint8Array.of(0x43, 0x58), PAYLOAD.slice(2))],
    ['another version', payload({ version: 2 })],
  ])('reads no burn payload from %s', (name, bytes) => {
    expect(parseBurnPayload(bytes)).toBeNull();
  });
});

describe('the signed burn\'s input data', () => {
  it('is each input\'s data in order, and none until every input is signed', () => {
    const tx = new Transaction(UTXOS.map((u) => new Input(u.txId, u.index)), []);
    expect(() => inputDataOf(tx)).toThrow('An input is not signed.');
    tx.inputs[0].setData(Buffer.from([1, 2]));
    expect(() => inputDataOf(tx)).toThrow('An input is not signed.');
    tx.inputs[1].setData(Buffer.from([3]));
    expect(inputDataOf(tx)).toEqual(['0102', '03']);
  });
});
