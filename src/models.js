/**
 * Copyright (c) Hathor Labs and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import moment from 'moment';
import { t } from 'ttag';
import { transactionUtils, constants } from '@hathor/wallet-lib'

const FEE_PER_FS_OUTPUT = constants.FEE_PER_FULL_SHIELDED_OUTPUT;
const FEE_PER_AS_OUTPUT = constants.FEE_PER_AMOUNT_SHIELDED_OUTPUT;

/**
 * Sum the FeeHeader entries on a raw tx (network fees declared
 * on-chain). Returns 0n when no fee headers are present or the
 * structure is unparseable.
 */
const computeNetworkFeeFromRaw = (rawTx) => {
  try {
    const headers = rawTx?.headers ?? [];
    let total = 0n;
    for (const h of headers) {
      const entries = h?.entries ?? [];
      for (const e of entries) {
        if (typeof e?.amount === 'bigint') {
          total += e.amount;
        }
      }
    }
    return total;
  } catch (_e) {
    return 0n;
  }
};

/**
 * Sum the per-shielded-output fee contributions on a raw tx. Modes:
 * 2 → FullShielded, 1 → AmountShielded. Returns 0n when the tx has
 * no shielded outputs.
 */
const computePrivacyFeeFromRaw = (rawTx) => {
  const shieldedOutputs = rawTx?.shielded_outputs ?? [];
  let total = 0n;
  for (const so of shieldedOutputs) {
    if (so?.mode === 2) {
      total += FEE_PER_FS_OUTPUT;
    } else if (so?.mode === 1) {
      total += FEE_PER_AS_OUTPUT;
    }
  }
  return total;
};

export class TxHistory {
  /**
   * @param {{
   *   txId: string;
   *   timestamp: number;
   *   tokenUid: string;
   *   balance: number;
   *   isVoided: boolean;
   *   version: number;
   *   ncId?: string;
   *   ncMethod?: string;
   *   ncCaller?: Address;
   *   firstBlock?: string;
   *   networkFee?: bigint;
   *   privacyFee?: bigint;
   * }}
   */
  constructor({
    txId,
    timestamp,
    tokenUid,
    balance,
    isVoided,
    version,
    ncId,
    ncMethod,
    ncCaller,
    firstBlock,
    networkFee = 0n,
    privacyFee = 0n,
  }) {
    /**
     * @type {string}
     */
    this.txId = txId;
    /**
     * @type {number}
     */
    this.timestamp = timestamp;
    /**
     * @type {string}
     */
    this.tokenUid = tokenUid;
    /**
     * @type {number}
     */
    this.balance = balance;
    /**
     * @type {boolean}
     */
    this.isVoided = isVoided;
    /**
     * @type {number}
     */
    this.version = version;
    /**
     * @type {string?}
     */
    this.ncId = ncId;
    /**
     * @type {string?}
     */
    this.ncMethod = ncMethod;
    /**
     * @type {Address?}
     */
    this.ncCaller = ncCaller;
    /**
     * @type {string?}
     */
    this.firstBlock = firstBlock;
    /**
     * Network fee declared on the tx via FeeHeader entries, in HTR
     * subunits. Computed once in `from()`. Always a bigint (0n when
     * the tx carries no fee header).
     * @type {bigint}
     */
    this.networkFee = networkFee;
    /**
     * Privacy fee — sum of per-shielded-output fees on the tx, in
     * HTR subunits. Always a bigint (0n for transparent-only txs).
     * @type {bigint}
     */
    this.privacyFee = privacyFee;
  }

  getDescription(token) {
    let { symbol } = token;
    if (this.tokenUid !== token.uid) {
      // This should never happen!
      symbol = t`Unknown`;
    }
    if (this.balance > 0) {
      return t`Received ${symbol}`;
    } if (this.balance < 0) {
      return t`Sent ${symbol}`;
    }
    return t`You sent ${symbol} to yourself`;
  }

  getTimestampFormat() {
    return moment.unix(this.timestamp).format('DD MMM YYYY [•] HH:mm');
  }

  getTimestampCalendar() {
    // See https://momentjs.com/docs/#/displaying/calendar-time/
    return moment.unix(this.timestamp).calendar(null, {
      sameDay: t`[Today •] HH:mm`,
      nextDay: t`[Tomorrow •] HH:mm`,
      nextWeek: t`dddd [•] HH:mm`,
      lastDay: t`[Yesterday •] HH:mm`,
      lastWeek: t`[Last] dddd [•] HH:mm`,
      sameElse: t`DD MMM YYYY [•] HH:mm`,
    });
  }

  getVersionInfo() {
    return transactionUtils.getTxType(this)
  }

  isNanoContract() {
    return this.version === constants.NANO_CONTRACTS_VERSION;
  }

  hasFirstBlock() {
    // not null, not undefined and not string empty
    return this.firstBlock != null && this.firstBlock.trim() !== '';
  }

  /**
   * Creates a TxHistory instance from raw transaction history data.
   *
   * @param {{
   *   txId: string;
   *   balance: number;
   *   timestamp: number;
   *   voided: boolean;
   *   version: number;
   *   ncId?: string;
   *   ncMethod?: string;
   *   ncCaller?: Address;
   *   firstBlock?: string;
   * }} rawTxHistory - The raw transaction history data.
   * @param {string} tokenUid - The UID of the token associated with the transaction.
   *
   * @returns {TxHistory} A TxHistory instance representing the transaction.
   */
  static from(rawTxHistory, tokenUid) {
    const {
      txId,
      timestamp,
      balance,
      version,
      ncId,
      ncMethod,
      ncCaller,
      firstBlock,
    } = rawTxHistory;
    return new TxHistory({
      txId,
      timestamp,
      balance,
      version,
      ncId,
      ncMethod,
      ncCaller,
      tokenUid,
      // in wallet service this comes as 0/1 and in the full node comes with true/false
      isVoided: Boolean(rawTxHistory.voided),
      firstBlock,
      // Compute and freeze fees here so the modal doesn't need access
      // to the raw `headers` / `shielded_outputs` payload, which the
      // wallet-service-formatted history may strip.
      networkFee: computeNetworkFeeFromRaw(rawTxHistory),
      privacyFee: computePrivacyFeeFromRaw(rawTxHistory),
    });
  }
}
