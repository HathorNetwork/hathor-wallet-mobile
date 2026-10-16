/**
 * Copyright (c) Hathor Labs and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import moment from 'moment';
import { t } from 'ttag';
import { transactionUtils, constants } from '@hathor/wallet-lib'
import { shieldedOutputsFee } from './shielded/fees';

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
   *   privacyFee?: bigint;
   *   hasShieldedActivity?: boolean;
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
    privacyFee = 0n,
    hasShieldedActivity = false,
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
     * The privacy part of the tx's fee: what its shielded outputs cost whoever paid the tx. The
     * tx details' Fees row shows it for any tx with fees, where the shielded UI shows.
     * @type {bigint}
     */
    this.privacyFee = privacyFee;
    /**
     * Whether the history says the tx has private outputs (fullnode facade) or moves the wallet's
     * private balance (wallet-service facade): the tx details then show that its unblinding
     * values are loading.
     * @type {boolean}
     */
    this.hasShieldedActivity = hasShieldedActivity;
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
   *   shielded_outputs?: Object[];
   *   txKind?: 'transparent'|'shielded'|'mixed';
   * }} rawTxHistory - The raw transaction history data. Its shielded outputs (fullnode facade)
   *   only give the privacy fee and hasShieldedActivity: they hold blinding factors, which the
   *   TxHistory doesn't keep. txKind (wallet-service facade) says whether the tx moves the
   *   wallet's private balance.
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
      privacyFee: shieldedOutputsFee(rawTxHistory.shielded_outputs),
      hasShieldedActivity: (rawTxHistory.shielded_outputs?.length ?? 0) > 0
        || rawTxHistory.txKind === 'shielded'
        || rawTxHistory.txKind === 'mixed',
    });
  }
}
