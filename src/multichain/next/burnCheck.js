/**
 * Copyright (c) Hathor Labs and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Address, constants, helpersUtils } from '@hathor/wallet-lib';
import { KNOWN_TRANSFER_ADDRESSES } from '../chains';
import { decodeAddressKeys } from './kit/address';
import { bytesToHex } from './kit/scalar';
import { SignRefusedError } from './signer';

/**
 * Checks the burn the Hathor Next backend built on Hathor Network before the wallet signs it. A
 * burn moves HTR to Hathor Next by paying the transfer address, from which nothing ever spends,
 * and names where the HTR arrives in a data output; a wrong destination loses the HTR for good.
 * A Hathor Network transaction can be read whole, so every byte of it is checked here:
 *
 * - output 0 is the data output carrying `"CT" ‖ 1 ‖ dest_network ‖ A ‖ B`, naming the pinned
 *   Hathor Next network and the Hathor Next address the user chose;
 * - one output pays the pinned transfer address exactly the amount the user chose;
 * - at most one more pays the change back to the address this wallet gave for it;
 * - the inputs are exactly the UTXOs this wallet chose, and nothing else is in it: a plain
 *   transaction, with no token list and no header. A header is signed with the inputs, so a nano
 *   contract header would make this wallet's input signature a contract caller's too.
 *
 * The transfer address must be one of the chain transfer's known addresses: never only the one a
 * backend names.
 *
 * The burn layout is hathor-next's (`htn-legacy::burn`, plan §3.3 and CT-D1).
 */

/** The value of the burn's data output, in base units: hathor-core needs a positive value. */
export const BURN_DATA_VALUE = 1n;
const PAYLOAD_PREFIX = [0x43, 0x54]; // "CT"
const PAYLOAD_VERSION = 1;
const PAYLOAD_LEN = 99;
const OP_PUSHDATA1 = 0x4c;
const OP_CHECKSIG = 0xac;

/**
 * The payload of a data script `push(payload) OP_CHECKSIG`, or null for any other script.
 *
 * @param {Uint8Array} script
 * @returns {Uint8Array|null}
 */
export function dataScriptPayload(script) {
  if (script.length < 2 || script[script.length - 1] !== OP_CHECKSIG) {
    return null;
  }
  let start;
  let len;
  if (script[0] < OP_PUSHDATA1) {
    [len] = script;
    start = 1;
  } else if (script[0] === OP_PUSHDATA1) {
    [, len] = script;
    start = 2;
  } else {
    return null;
  }
  if (start + len + 1 !== script.length) {
    return null;
  }
  return script.slice(start, start + len);
}

/**
 * The burn payload naming where the HTR arrives: `"CT" ‖ 1 ‖ dest_network ‖ A ‖ B`.
 *
 * @param {Uint8Array} payload
 * @returns {{ destinationNetwork: string, view: string, spend: string }|null} Hex
 */
export function parseBurnPayload(payload) {
  if (
    payload?.length !== PAYLOAD_LEN
    || payload[0] !== PAYLOAD_PREFIX[0]
    || payload[1] !== PAYLOAD_PREFIX[1]
    || payload[2] !== PAYLOAD_VERSION
  ) {
    return null;
  }
  return {
    destinationNetwork: bytesToHex(payload.slice(3, 35)),
    view: bytesToHex(payload.slice(35, 67)),
    spend: bytesToHex(payload.slice(67, 99)),
  };
}

const scriptOf = (address, network) => bytesToHex(new Address(address, { network }).getScript());

/**
 * Runs `parse` with a Buffer's subarray returning a Buffer, as on Node. Hermes ignores
 * Symbol.species, so under the app's buffer@4 polyfill a Buffer's subarray is a plain Uint8Array,
 * without the readers wallet-lib's transaction parser calls on it. The parse is synchronous, and
 * the polyfill's own subarray is back before this returns.
 *
 * @param {Function} parse
 * @returns {*} What `parse` returns
 */
function withBufferSubarray(parse) {
  const own = Object.getOwnPropertyDescriptor(Buffer.prototype, 'subarray');
  const typedSubarray = Uint8Array.prototype.subarray;
  Buffer.prototype.subarray = function subarray(start, end) {
    const view = typedSubarray.call(this, start, end);
    if (!(view instanceof Buffer)) {
      Object.setPrototypeOf(view, Buffer.prototype);
    }
    return view;
  };
  try {
    return parse();
  } finally {
    if (own) {
      Object.defineProperty(Buffer.prototype, 'subarray', own);
    } else {
      delete Buffer.prototype.subarray;
    }
  }
}

/**
 * @param {string} txHex The unsigned burn the backend built
 * @param {Object} expected
 * @param {Object} expected.network wallet-lib's Network
 * @param {{ txId: string, index: number, value: bigint }[]} expected.utxos The inputs chosen
 * @param {bigint} expected.amount What the user chose to move
 * @param {string} expected.transferAddress The pinned transfer address
 * @param {string|null} expected.changeAddress Where the change goes, when there is change
 * @param {string} expected.destinationNetwork The pinned Hathor Next network id, hex
 * @param {string} expected.destination The Hathor Next address the user chose: this wallet's own
 *   or anyone's
 * @returns {Object} The parsed transaction, ready to sign
 * @throws {SignRefusedError}
 */
export function checkBurn(txHex, {
  network,
  utxos,
  amount,
  transferAddress,
  changeAddress,
  destinationNetwork,
  destination,
}) {
  let tx;
  try {
    tx = withBufferSubarray(() => helpersUtils.createTxFromHex(txHex, network));
  } catch (e) {
    throw new SignRefusedError(`The burn can't be read: ${e.message}`);
  }
  const refuse = (message) => {
    throw new SignRefusedError(message);
  };

  if (tx.version !== constants.DEFAULT_TX_VERSION || (tx.tokens ?? []).length > 0
    || (tx.headers ?? []).length > 0 || tx.isNanoContract?.()) {
    refuse('The burn is not a plain transaction.');
  }
  if (!KNOWN_TRANSFER_ADDRESSES.includes(transferAddress)) {
    refuse('The burn pays an address that is not the chain transfer\'s.');
  }

  const chosen = new Set(utxos.map((u) => `${u.txId}:${u.index}`));
  const spent = tx.inputs.map((input) => `${input.hash}:${input.index}`);
  if (spent.length !== chosen.size || spent.some((key) => !chosen.has(key))
    || new Set(spent).size !== spent.length) {
    refuse('The burn spends other outputs than the ones this wallet chose.');
  }
  const total = utxos.reduce((sum, u) => sum + u.value, 0n);

  const [data, ...rest] = tx.outputs;
  if (!data || BigInt(data.value) !== BURN_DATA_VALUE || data.tokenData !== 0) {
    refuse('The burn doesn\'t start with its data output.');
  }
  const named = parseBurnPayload(dataScriptPayload(Uint8Array.from(data.script)));
  let wanted;
  try {
    wanted = decodeAddressKeys(destination);
  } catch (e) {
    refuse(`The chosen Hathor Next address can't be read: ${e.message}`);
  }
  if (
    !named
    || named.destinationNetwork !== destinationNetwork
    || named.view !== bytesToHex(wanted.view)
    || named.spend !== bytesToHex(wanted.spend)
  ) {
    refuse('The burn sends the HTR somewhere else than the chosen Hathor Next address.');
  }

  const transferScript = scriptOf(transferAddress, network);
  const changeScript = changeAddress ? scriptOf(changeAddress, network) : null;
  const transfers = rest.filter((o) => bytesToHex(o.script) === transferScript);
  const changes = rest.filter((o) => changeScript && bytesToHex(o.script) === changeScript);
  if (transfers.length !== 1 || changes.length > 1
    || transfers.length + changes.length !== rest.length) {
    refuse('The burn pays other outputs than the transfer and the change.');
  }
  if (rest.some((o) => o.tokenData !== 0)) {
    refuse('The burn moves another token than HTR.');
  }
  if (BigInt(transfers[0].value) !== amount) {
    refuse('The burn moves another amount than the one chosen.');
  }
  const change = changes.length ? BigInt(changes[0].value) : 0n;
  if (total !== amount + BURN_DATA_VALUE + change) {
    refuse('The burn\'s inputs and outputs don\'t add up.');
  }
  return tx;
}

/**
 * The input data of a signed transaction, in input order, for the backend to put in.
 *
 * @param {Object} tx A wallet-lib transaction after signTx
 * @returns {string[]} Hex
 */
export function inputDataOf(tx) {
  return tx.inputs.map((input) => {
    if (!input.data) {
      throw new Error('An input is not signed.');
    }
    return bytesToHex(Uint8Array.from(input.data));
  });
}
