/**
 * Copyright (c) Hathor Labs and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { describe, it, expect } from '@jest/globals';
import {
  Address,
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
  nextAddress: NEXT_ADDRESS,
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

  it('passes an exact spend with no change', () => {
    expect(() => checkBurn(burnHex({ change: 0n, amount: 999n }), {
      ...expected,
      amount: 999n,
      changeAddress: null,
    })).not.toThrow();
  });

  it.each([
    ['another Hathor Next network', { data: payload({ dest: '00'.repeat(32) }) }],
    ['another Hathor Next wallet', { data: payload({ spend: bytesToHex(publicKeyOf(12n)) }) }],
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
