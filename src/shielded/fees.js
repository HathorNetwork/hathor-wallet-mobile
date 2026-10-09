/**
 * Copyright (c) Hathor Labs and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { constants as hathorLibConstants, shielded } from '@hathor/wallet-lib';
import { logger } from '../logger';

const log = logger('shielded-fees');

const {
  FEE_PER_AMOUNT_SHIELDED_OUTPUT,
  FEE_PER_FULL_SHIELDED_OUTPUT,
  NATIVE_TOKEN_UID,
} = hathorLibConstants;
const { ShieldedOutputMode } = shielded;

/**
 * The privacy fee of one shielded output, from its history entry's `mode`. An entry without a
 * known mode is fully shielded when it carries an asset commitment.
 *
 * @param {Object} output A tx.shielded_outputs entry
 * @returns {bigint}
 */
function shieldedOutputFee(output) {
  switch (output?.mode) {
    case ShieldedOutputMode.FULLY_SHIELDED:
      return FEE_PER_FULL_SHIELDED_OUTPUT;
    case ShieldedOutputMode.AMOUNT_SHIELDED:
      return FEE_PER_AMOUNT_SHIELDED_OUTPUT;
    default:
      return output?.asset_commitment
        ? FEE_PER_FULL_SHIELDED_OUTPUT
        : FEE_PER_AMOUNT_SHIELDED_OUTPUT;
  }
}

/**
 * The privacy fee a tx's shielded outputs cost whoever paid the tx, in HTR:
 * FEE_PER_AMOUNT_SHIELDED_OUTPUT per amount-shielded output and FEE_PER_FULL_SHIELDED_OUTPUT per
 * fully shielded one. It is part of the fee the tx declares, not on top of it.
 *
 * @param {Object[]|undefined} shieldedOutputs The tx's shielded_outputs, as the history has them
 * @returns {bigint}
 */
export function shieldedOutputsFee(shieldedOutputs) {
  let total = 0n;
  for (const output of shieldedOutputs ?? []) {
    total += shieldedOutputFee(output);
  }
  return total;
}

/**
 * Whether the wallet paid a tx: one of the tx's inputs, in the wallet's history, spends an output
 * of the wallet. The wallet's shielded inputs carry their address there too; an input of another
 * wallet's shielded output has none.
 *
 * @param {HathorWallet} wallet A fullnode-facade wallet
 * @param {string} txId
 * @returns {Promise<boolean>}
 */
export async function isTxPaidByWallet(wallet, txId) {
  const tx = await wallet.getTx(txId);
  const addresses = [...new Set(
    (tx?.inputs ?? [])
      .map((input) => input.decoded?.address)
      .filter((address) => typeof address === 'string'),
  )];
  if (addresses.length === 0) {
    return false;
  }
  const mine = await wallet.checkAddressesMine(addresses);
  return addresses.some((address) => mine[address] === true);
}

/**
 * The total of a tx's HTR fees, from the fees the fullnode lists for its fee header, or null
 * when it lists none in HTR. Amounts come as numbers, or strings, or bigints.
 *
 * @param {Object[]|undefined} fees The tx's fees: [{ token_uid, amount }]
 * @returns {bigint|null}
 */
function nativeFeesTotal(fees) {
  if (!Array.isArray(fees)) {
    return null;
  }
  const native = fees.filter((entry) => entry?.token_uid === NATIVE_TOKEN_UID);
  if (native.length === 0) {
    return null;
  }
  return native.reduce((sum, entry) => sum + BigInt(entry.amount), 0n);
}

/**
 * The fees of a tx the wallet paid: its total HTR fee, the privacy fee of its shielded outputs,
 * and the network fee, the rest. The history has no fees: the fullnode's tx API lists them, so
 * this asks the fullnode, and only for a tx the wallet paid. It is null for a tx the wallet
 * didn't pay, for a tx with no HTR fee, and when a request fails, which is logged.
 *
 * @param {HathorWallet} wallet A fullnode-facade wallet
 * @param {string} txId
 * @param {bigint} privacyFee The privacy fee of the tx's shielded outputs
 * @returns {Promise<{ total: bigint, network: bigint, privacy: bigint }|null>}
 */
export async function getWalletPaidFees(wallet, txId, privacyFee = 0n) {
  try {
    if (!(await isTxPaidByWallet(wallet, txId))) {
      return null;
    }
    const response = await wallet.getFullTxById(txId);
    const total = nativeFeesTotal(response?.tx?.fees);
    if (total === null) {
      return null;
    }
    return {
      total,
      privacy: privacyFee,
      network: total > privacyFee ? total - privacyFee : 0n,
    };
  } catch (e) {
    log.error('Failed to load the fees of a transaction.', e);
    return null;
  }
}
