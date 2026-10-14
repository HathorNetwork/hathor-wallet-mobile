/**
 * Copyright (c) Hathor Labs and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { constants as hathorLibConstants, errors, shielded } from '@hathor/wallet-lib';
import { t } from 'ttag';
import { PRIVACY_MODE } from '../constants';

const {
  FEE_PER_AMOUNT_SHIELDED_OUTPUT,
  FEE_PER_FULL_SHIELDED_OUTPUT,
  MAX_SHIELDED_OUTPUT_VALUE,
} = hathorLibConstants;
const { ShieldedOutputMode } = shielded;

/**
 * The largest amount a private output can hold, in base units: a shielded output's range proof
 * covers values below MAX_SHIELDED_OUTPUT_VALUE.
 */
export const MAX_PRIVATE_AMOUNT = MAX_SHIELDED_OUTPUT_VALUE - 1n;

/**
 * Whether a private output can hold the amount.
 *
 * @param {bigint} amount In base units
 * @returns {boolean}
 */
export function isPrivateAmountAllowed(amount) {
  return amount > 0n && amount < MAX_SHIELDED_OUTPUT_VALUE;
}

/**
 * The wallet-lib shielded mode of a send's output in a privacy mode: none for a public output,
 * AMOUNT_SHIELDED to hide the amount, FULLY_SHIELDED to hide the amount and the token.
 *
 * @param {string} privacyMode One of PRIVACY_MODE
 * @returns {number|null} A ShieldedOutputMode, or null for a public output
 * @throws {Error} For a value that is not a privacy mode
 */
export function privacyModeToShieldedMode(privacyMode) {
  switch (privacyMode) {
    case PRIVACY_MODE.PUBLIC:
      return null;
    case PRIVACY_MODE.HIDE_AMOUNT:
      return ShieldedOutputMode.AMOUNT_SHIELDED;
    case PRIVACY_MODE.PRIVATE:
      return ShieldedOutputMode.FULLY_SHIELDED;
    default:
      throw new Error(`Unknown privacy mode '${privacyMode}'`);
  }
}

/**
 * The output that pays the recipient of a send. wallet-lib takes an output with a shieldedMode
 * key as a shielded one, whatever its value, so a public output has no such key: one that
 * holds undefined fails the build ("Invalid shieldedMode 'undefined'").
 *
 * @param {Object} params
 * @param {string} params.address The recipient
 * @param {bigint} params.amount In base units
 * @param {string} params.tokenUid
 * @param {number|null} params.shieldedMode From privacyModeToShieldedMode
 * @returns {{ address: string, value: bigint, token: string, shieldedMode?: number }}
 */
export function buildSendOutput({
  address,
  amount,
  tokenUid,
  shieldedMode,
}) {
  const output = { address, value: amount, token: tokenUid };
  if (shieldedMode !== null && shieldedMode !== undefined) {
    output.shieldedMode = shieldedMode;
  }
  return output;
}

/**
 * Waits until the wallet is ready. A reconnect, or the walk that decodes private outputs after
 * an unlock, processes the history again in PROCESSING and rebuilds the wallet's UTXOs, so a
 * send built meanwhile could select from part of them.
 *
 * @param {HathorWallet} wallet
 * @returns {{ promise: Promise<boolean>, cancel: function(): void }} The promise resolves
 *   true once the wallet is ready, at once when it is, or false when cancel() stops the wait
 */
export function waitForWalletReady(wallet) {
  let cancel = () => {};
  const promise = new Promise((resolve) => {
    if (wallet.isReady()) {
      resolve(true);
      return;
    }
    const onState = () => {
      if (wallet.isReady()) {
        wallet.removeListener('state', onState);
        resolve(true);
      }
    };
    cancel = () => {
      wallet.removeListener('state', onState);
      resolve(false);
    };
    wallet.on('state', onState);
  });
  return { promise, cancel };
}

/**
 * The fees of a prepared send, from what wallet-lib built:
 * - total: the fee the tx declares, the sum of its fee header's entries, all in HTR;
 * - privacy: what its shielded outputs cost, change and split outputs included: the fee of an
 *   amount-shielded output for each one, and of a fully shielded output for each one, by the
 *   shieldedMode the prepared tx gives them;
 * - network: the rest of the total;
 * - privateOutputs: how many shielded outputs it has.
 * A send without shielded outputs, as every send of the wallet-service facade, pays no privacy
 * fee.
 *
 * @param {Object} sendTx A SendTransaction or SendTransactionWalletService, prepared
 * @returns {{ total: bigint, privacy: bigint, network: bigint, privateOutputs: number }}
 * @throws {Error} When the fee header has an entry in another token than HTR
 */
export function computeSendFees(sendTx) {
  const entries = sendTx.transaction?.getFeeHeader()?.entries ?? [];
  let total = 0n;
  for (const entry of entries) {
    if (entry.tokenIndex !== 0) {
      throw new Error('Unexpected fee entry with non-HTR token index');
    }
    total += entry.amount;
  }

  const shieldedOutputs = sendTx.fullTxData?.shieldedOutputs ?? [];
  let privacy = 0n;
  for (const output of shieldedOutputs) {
    privacy += output.shieldedMode === ShieldedOutputMode.FULLY_SHIELDED
      ? FEE_PER_FULL_SHIELDED_OUTPUT
      : FEE_PER_AMOUNT_SHIELDED_OUTPUT;
  }

  return {
    total,
    privacy,
    network: total > privacy ? total - privacy : 0n,
    privateOutputs: shieldedOutputs.length,
  };
}

// The start of wallet-lib's messages for a change its rules made private, but that can't be:
// the change stands in for a shielded input the token lacks, so the amount of its only private
// output can't be computed by subtraction; or the change was forced on a private UTXO the
// selection spent exactly, so its value can't be.
const STAND_IN_CHANGE = "The change must be shielded (so the amount of its token's only shielded output cannot be computed by subtraction), but ";
const FORCED_CHANGE = 'The change must be shielded (so the value of the shielded UTXO spent exactly cannot be computed by subtraction), but ';

// The messages of a private change the wallet can't receive: ShieldedChangeUnavailableError's.
const CHANGE_UNAVAILABLE = [
  `${STAND_IN_CHANGE}a shielded change is not supported for multisig wallets`,
  `${STAND_IN_CHANGE}the wallet has no shielded address to receive it`,
  'A shielded change is not supported for multisig wallets',
  'A shielded change is required, but the wallet has no shielded address to receive it',
];

// wallet-lib's messages for a privacy fee the HTR the wallet can add doesn't cover. The rules
// keep a change private even when the payment is public, and a private change pays its own fee.
const UNPAID_PRIVACY_FEE = [
  'HTR change is too small to fund its shielded-output fee',
  'The shielded HTR change is too small to split into the two shielded outputs',
  'The HTR change cannot fund the shielded-output split',
  'Splitting the lone shielded output requires extra HTR for its fee',
  "The transaction's only shielded output holds ",
];

// A selection short of HTR because a change was made private says so after the usual message.
const SHIELDED_CHANGE_FEE = 'The amount includes the fee to shield the change';

const SHIELDED_LOCKED = 'shielded-locked';

/**
 * Whether the error is of a wallet-lib error class. The class may be missing from the wallet-lib
 * build the app runs with, in which case the error isn't of it.
 *
 * @param {unknown} error
 * @param {Function|undefined} ErrorClass
 * @returns {boolean}
 */
function isErrorOf(error, ErrorClass) {
  return typeof ErrorClass === 'function' && error instanceof ErrorClass;
}

/**
 * The copy for an error of a send that involves private outputs, or null for any other error.
 * wallet-lib fails such a send rather than make public what its rules keep private, and its
 * messages suggest an option this app doesn't offer: keeping the change public. They are
 * matched by their text, since every one of them is a SendTxError, and by their class where the
 * wallet-lib build has it: a dApp's send reaches the app with the message alone.
 *
 * @param {unknown} error
 * @returns {string|null}
 */
export function mapShieldedSendError(error) {
  if (isErrorOf(error, errors.ShieldedKeyError) && error.errorCode === SHIELDED_LOCKED) {
    return t`Your private balance is locked. Unlock it to send privately.`;
  }
  const message = typeof error?.message === 'string' ? error.message : '';
  const changeUnavailable = t`This wallet cannot receive the private change this transaction needs.`;
  if (isErrorOf(error, errors.ShieldedChangeUnavailableError)
    || CHANGE_UNAVAILABLE.some((start) => message.startsWith(start))
    || (message.startsWith("The transaction's only shielded output holds ")
      && message.includes('the wallet cannot receive a shielded change'))) {
    return changeUnavailable;
  }
  if (message.startsWith(FORCED_CHANGE)) {
    return t`To keep the value of the private funds it spends hidden, this transaction needs a private change, and there is not enough HTR to pay its privacy fee.`;
  }
  if (message.startsWith(STAND_IN_CHANGE)
    && (message.includes('no HTR change is left') || message.includes('too small to fund'))) {
    return t`To keep the amount it sends hidden, this transaction needs a private change, and there is not enough HTR to pay its privacy fee.`;
  }
  if (message.includes(SHIELDED_CHANGE_FEE)
    || UNPAID_PRIVACY_FEE.some((start) => message.startsWith(start))) {
    return t`Insufficient HTR to cover the privacy fees of this transaction.`;
  }
  if (/^Shielded output \d+: value must be in \[1, 2\^40\)/.test(message)) {
    return t`An amount in this transaction, its change included, is too large to be private.`;
  }
  if (message.startsWith('Shielded crypto provider is not set')) {
    return t`Private transfers could not be loaded on this device.`;
  }
  if (message.startsWith("The wallet's shielded change address could not be resolved")) {
    return t`The private change of this transaction could not be prepared. Try again.`;
  }
  return null;
}

// wallet-lib's message for a change its rules made private, which the legacy change address a
// dApp asked for can't receive.
const LEGACY_CHANGE_ADDRESS = /^The change must be shielded \(.+\), and a legacy change address cannot receive it/;

/**
 * The copy for a dApp's send that failed while it was prepared because of the wallet's private
 * funds, or null for any other failure. A send that spends private funds keeps its change
 * private; the change address a dApp passes is a legacy one, which can't receive it.
 *
 * @param {string} message The message of the error the rpc handler wrapped
 * @returns {string|null}
 */
export function mapDappSendPrepareError(message) {
  if (LEGACY_CHANGE_ADDRESS.test(message ?? '')) {
    return t`This transaction spends private funds, so its change must stay private, but the dApp asked to send the change to an address that can't receive private funds.`;
  }
  return mapShieldedSendError({ message });
}
