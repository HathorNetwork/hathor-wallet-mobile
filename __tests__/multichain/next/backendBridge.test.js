/**
 * Copyright (c) Hathor Labs and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { describe, it, expect } from '@jest/globals';
import {
  Address,
  Input,
  Network,
  Output,
  Transaction,
} from '@hathor/wallet-lib';
import { NEXT_CLIENT_ERROR } from '../../../src/multichain/nextClientErrors';
import { createBackendBridge } from '../../../src/multichain/next/backendBridge';
import { BURN_DATA_VALUE } from '../../../src/multichain/next/burnCheck';
import { encodeAddress } from '../../../src/multichain/next/kit/address';
import { publicKeyOf } from '../../../src/multichain/next/kit/keys';
import { bytesToHex, concatBytes, hexToBytes } from '../../../src/multichain/next/kit/scalar';
import { CHAIN } from '../../../src/multichain/chains';

const network = new Network('privatenet');
const TRANSFER = 'WScTqhLsBQnz3HMdQqh66JBgWqb255XffL';
const CHANGE = 'WXkMhVgRVmTXTVh47wauPKm1xcrW8Qf3Vb';
const DEST_NETWORK = 'd5'.repeat(32);
const VIEW = bytesToHex(publicKeyOf(7n));
const SPEND = bytesToHex(publicKeyOf(11n));
const OWN = encodeAddress(VIEW, SPEND);
const NATIVE = 'aa'.repeat(32);
const UTXOS = [{ txId: '01'.repeat(32), index: 1, value: 1000n }];

const CONFIG = {
  client: 'backend',
  nativeTokenId: NATIVE,
  directions: [{ from: CHAIN.HATHOR, to: CHAIN.HATHOR_NEXT }],
  transfer: {
    transfer_address: TRANSFER,
    destination_network: DEST_NETWORK,
    confirmations: 21,
    mean_block_ms: 5000,
  },
};

function unsignedBurn({ spend = SPEND, amount = 700n } = {}) {
  const payload = concatBytes(
    Uint8Array.of(0x43, 0x54, 1),
    hexToBytes(DEST_NETWORK),
    hexToBytes(VIEW),
    hexToBytes(spend),
  );
  const script = concatBytes(Uint8Array.of(0x4c, payload.length), payload, Uint8Array.of(0xac));
  const data = Buffer.from(script);
  const p2pkh = (address) => new Address(address, { network }).getScript();
  const tx = new Transaction(
    UTXOS.map((u) => new Input(u.txId, u.index)),
    [
      new Output(BURN_DATA_VALUE, data),
      new Output(amount, p2pkh(TRANSFER)),
      new Output(1000n - amount - 1n, p2pkh(CHANGE)),
    ],
    { version: 1, timestamp: 1790000000, parents: ['aa'.repeat(32), 'bb'.repeat(32)], weight: 1 },
  );
  return tx.toHex();
}

function fakes({ burn = unsignedBurn(), signTransfer = null, transfer = null } = {}) {
  const calls = { created: null, signed: null, sign: 0, cancelled: [], markedUsed: 0 };
  const wallet = {
    getUtxosForAmount: async () => ({ utxos: UTXOS, changeAmount: 299n }),
    getCurrentAddress: async ({ markAsUsed } = {}) => {
      if (markAsUsed) calls.markedUsed += 1;
      return { address: CHANGE };
    },
    signTx: async (tx) => {
      calls.sign += 1;
      // eslint-disable-next-line no-param-reassign -- signTx fills in the inputs it signs
      tx.inputs.forEach((input, i) => { input.data = Buffer.from([0xab, i]); });
      return tx;
    },
  };
  const client = {
    getNetwork: () => 'privatenet',
    getAddress: () => OWN,
    createTransfer: async (request) => {
      calls.created = request;
      return { id: 'transfer-1', unsigned_tx: burn };
    },
    // The backend reports the destination it was asked for.
    signTransfer: signTransfer ?? (async (id, inputData) => {
      calls.signed = { id, inputData };
      return {
        id,
        amount: '700',
        burn_tx_id: 'ee'.repeat(32),
        status: 'pushed',
        confirmations: 0,
        needed: 21,
        destination: calls.created.destination,
      };
    }),
    cancelTransfer: async (id) => { calls.cancelled.push(id); },
    getTransfer: async (id) => ({ id, amount: '700', ...(transfer?.(calls) ?? {}) }),
    getTransfers: async () => [
      { id: 'old', amount: '5', status: 'eligible', burn_tx_id: 'cc'.repeat(32), created_at: 10 },
      { id: 'new', amount: '9', status: 'confirming', burn_tx_id: 'dd'.repeat(32), created_at: 20 },
      { id: 'unsigned', amount: '3', status: 'awaiting_signatures', created_at: 30 },
      { id: 'dropped', amount: '4', status: 'cancelled', created_at: 40 },
      { id: 'bad', amount: '6', status: 'failed', burn_tx_id: 'ab'.repeat(32), created_at: 5 },
    ],
  };
  return { wallet, client, calls };
}

const transferArgs = {
  from: CHAIN.HATHOR,
  to: CHAIN.HATHOR_NEXT,
  tokenId: '00',
  amount: 700n,
  toAddress: OWN,
  ownAddress: OWN,
  pinCode: '123456',
};

describe('the bridge through the Hathor Next backend', () => {
  it('checks the backend\'s burn, signs it with the Hathor Network wallet and returns the transfer', async () => {
    const { wallet, client, calls } = fakes();
    const bridge = createBackendBridge(CONFIG, { wallet, network, client });
    const record = await bridge.transfer(transferArgs);
    expect(calls.sign).toBe(1);
    expect(calls.signed).toEqual({ id: 'transfer-1', inputData: ['ab00'] });
    expect(record).toMatchObject({
      id: 'transfer-1',
      amount: '700',
      receiveAmount: '700',
      nextTokenId: NATIVE,
      toOwn: true,
      status: 'pending',
      sourceTxId: 'ee'.repeat(32),
      debitedOnSource: true,
    });
  });

  it('signs nothing when the burn names another Hathor Next wallet, and cancels it', async () => {
    const burn = unsignedBurn({ spend: bytesToHex(publicKeyOf(12n)) });
    const { wallet, client, calls } = fakes({ burn });
    const bridge = createBackendBridge(CONFIG, { wallet, network, client });
    await expect(bridge.transfer(transferArgs)).rejects.toMatchObject({
      code: NEXT_CLIENT_ERROR.TRANSFER_REFUSED,
    });
    expect(calls.sign).toBe(0);
    expect(calls.signed).toBeNull();
    expect(calls.cancelled).toEqual(['transfer-1']);
    // The change address stays unused: nothing was signed.
    expect(calls.markedUsed).toBe(0);
  });

  it('gives the backend nothing secret: the PIN stays with wallet-lib\'s signTx', async () => {
    const { wallet, client } = fakes();
    const sent = [];
    for (const name of ['createTransfer', 'signTransfer', 'cancelTransfer', 'getTransfer']) {
      const original = client[name];
      client[name] = (...args) => {
        sent.push(JSON.stringify(args, (k, v) => (typeof v === 'bigint' ? v.toString() : v)));
        return original(...args);
      };
    }
    let pinAtSigning = null;
    const { signTx } = wallet;
    wallet.signTx = (tx, options) => {
      pinAtSigning = options.pinCode;
      return signTx(tx, options);
    };
    await createBackendBridge(CONFIG, { wallet, network, client }).transfer(transferArgs);
    expect(pinAtSigning).toBe(transferArgs.pinCode);
    expect(sent.length).toBeGreaterThan(0);
    expect(sent.join('\n')).not.toContain(transferArgs.pinCode);
  });

  it('marks the change address used once the burn is signed', async () => {
    const { wallet, client, calls } = fakes();
    await createBackendBridge(CONFIG, { wallet, network, client }).transfer(transferArgs);
    expect(calls.markedUsed).toBe(1);
  });

  it('never takes a transfer for this wallet\'s own unless its destination says so', async () => {
    // A status that doesn't say where the burn goes: the transfer sent here keeps its own choice.
    const { wallet, client } = fakes({
      signTransfer: async (id) => ({
        id, amount: '700', burn_tx_id: 'ee'.repeat(32), status: 'pushed', confirmations: 0, needed: 21,
      }),
    });
    const bridge = createBackendBridge(CONFIG, { wallet, network, client });
    await expect(bridge.transfer(transferArgs))
      .resolves.toMatchObject({ toAddress: OWN, toOwn: true });
    // Listed ones it can't place are nobody's: never counted as arriving here.
    const listed = await bridge.getTransfers();
    expect(listed.map((r) => [r.toAddress, r.toOwn])).toEqual([
      [null, false], [null, false], [null, false],
    ]);
  });

  it('moves HTR to the Hathor Next address chosen, anyone\'s, and the burn must name it', async () => {
    const theirSpend = bytesToHex(publicKeyOf(13n));
    const elsewhere = encodeAddress(VIEW, theirSpend);
    const { wallet, client, calls } = fakes({ burn: unsignedBurn({ spend: theirSpend }) });
    const record = await createBackendBridge(CONFIG, { wallet, network, client })
      .transfer({ ...transferArgs, toAddress: elsewhere });
    expect(calls.created.destination).toBe(elsewhere);
    expect(record).toMatchObject({ toAddress: elsewhere, toOwn: false });

    // The backend can't send it elsewhere: not even to this wallet's own address.
    const own = fakes();
    await expect(createBackendBridge(CONFIG, { wallet: own.wallet, network, client: own.client })
      .transfer({ ...transferArgs, toAddress: elsewhere })).rejects.toMatchObject({
      code: NEXT_CLIENT_ERROR.TRANSFER_REFUSED,
    });
    expect(own.calls.sign).toBe(0);
  });

  it('takes the address in any form, and refuses one that is not a Hathor Next address', async () => {
    const { wallet, client, calls } = fakes();
    const bridge = createBackendBridge(CONFIG, { wallet, network, client });
    await expect(bridge.transfer({ ...transferArgs, toAddress: OWN.toUpperCase() }))
      .resolves.toMatchObject({ id: 'transfer-1', toOwn: true });
    expect(calls.created.destination).toBe(OWN);
    await expect(bridge.transfer({ ...transferArgs, toAddress: CHANGE })).rejects.toMatchObject({
      code: NEXT_CLIENT_ERROR.TRANSFER_BAD_ADDRESS,
    });
  });

  it('never calls a signed transfer with no answer a failure: it is settled by asking', async () => {
    const signTransfer = async () => { throw new Error('timeout'); };
    let state = 'awaiting_signatures';
    const { wallet, client, calls } = fakes({
      signTransfer,
      transfer: () => ({ status: state, burn_tx_id: state === 'pushed' ? 'ee'.repeat(32) : null }),
    });
    const bridge = createBackendBridge(CONFIG, { wallet, network, client });
    await expect(bridge.transfer(transferArgs)).rejects.toMatchObject({
      code: NEXT_CLIENT_ERROR.TRANSFER_UNCERTAIN,
      transferId: 'transfer-1',
    });
    expect(calls.cancelled).toEqual([]);

    // The signatures never reached the backend: cancelled, and nothing left the wallet.
    client.cancelTransfer = async (id) => { calls.cancelled.push(id); state = 'cancelled'; };
    await expect(bridge.resolveTransfer('transfer-1')).resolves.toBeNull();
    expect(calls.cancelled).toEqual(['transfer-1']);

    // They did: the burn is on its way, and it is the outcome.
    state = 'pushed';
    await expect(bridge.resolveTransfer('transfer-1')).resolves.toMatchObject({
      id: 'transfer-1',
      sourceTxId: 'ee'.repeat(32),
    });
  });

  it('refuses an amount that needs more outputs than one burn holds', async () => {
    const { wallet, client } = fakes();
    wallet.getUtxosForAmount = async () => ({
      utxos: Array.from({ length: 256 }, (_, i) => ({ txId: 'aa'.repeat(32), index: i, value: 1 })),
      changeAmount: 0n,
    });
    const bridge = createBackendBridge(CONFIG, { wallet, network, client });
    await expect(bridge.transfer(transferArgs)).rejects.toMatchObject({
      code: NEXT_CLIENT_ERROR.TRANSFER_TOO_MANY_INPUTS,
    });
  });

  it('quotes the data output\'s base unit as the fee and the HTR one for one', () => {
    const { wallet, client } = fakes();
    const bridge = createBackendBridge(CONFIG, { wallet, network, client });
    expect(bridge.quote({ amount: 700n, available: 1000n })).toMatchObject({
      networkFee: 1n,
      receiveAmount: 700n,
      max: 999n,
      etaSeconds: 105,
    });
  });

  it('gives what arrives at the network\'s pinned scale', () => {
    const { wallet, client } = fakes();
    const unscaled = createBackendBridge({ ...CONFIG, mintScale: '1' }, { wallet, network, client });
    expect(unscaled.quote({ amount: 700n, available: 1000n }).receiveAmount).toBe(700n);
    const scaled = createBackendBridge(
      { ...CONFIG, mintScale: '1000000' },
      { wallet, network, client },
    );
    expect(scaled.quote({ amount: 700n, available: 1000n }).receiveAmount).toBe(700000000n);
  });

  it('lists the backend\'s transfers, newest first', async () => {
    const { wallet, client } = fakes();
    const bridge = createBackendBridge(CONFIG, { wallet, network, client });
    const list = await bridge.getTransfers();
    // Burns that never reached the network are no transfer; a failed one shows as failed.
    expect(list.map((r) => [r.id, r.status, r.progress.stage, r.debitedOnSource])).toEqual([
      ['new', 'pending', 'confirming', true],
      ['old', 'pending', 'eligible', true],
      ['bad', 'failed', 'failed', false],
    ]);
  });
});
