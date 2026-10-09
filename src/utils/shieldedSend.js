/**
 * Copyright (c) Hathor Labs and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { constants as hathorLibConstants, shielded } from '@hathor/wallet-lib';
import { DEFAULT_PRIVACY_MODE, PRIVACY_MODE } from '../constants';

const {
  FEE_PER_AMOUNT_SHIELDED_OUTPUT,
  FEE_PER_FULL_SHIELDED_OUTPUT,
  MAX_SHIELDED_OUTPUT_VALUE,
} = hathorLibConstants;
const { ShieldedOutputMode } = shielded;

/**
 * The privacy modes a send to the recipient can take. A legacy address can only receive a
 * public output. A private address only gets private ones: a public output to it would pay the
 * address of its spend key, in public.
 *
 * @param {boolean} recipientIsShielded Whether the recipient is a private (shielded) address
 * @returns {string[]} Modes of PRIVACY_MODE
 */
export function getPrivacyModeOptions(recipientIsShielded) {
  return recipientIsShielded
    ? [PRIVACY_MODE.HIDE_AMOUNT, PRIVACY_MODE.PRIVATE]
    : [PRIVACY_MODE.PUBLIC];
}

/**
 * The mode a send starts in: the preferred mode when the recipient can take it, else the first
 * mode it can take.
 *
 * @param {string[]} options The modes the send can take, from getPrivacyModeOptions
 * @param {string} [preferred] The preferred mode
 * @returns {string}
 */
export function initialPrivacyMode(options, preferred = DEFAULT_PRIVACY_MODE) {
  return options.includes(preferred) ? preferred : options[0];
}

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
