/**
 * Copyright (c) Hathor Labs and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Address } from '@hathor/wallet-lib';
import moment from 'moment';
import { t } from 'ttag';

/**
 * Map a version name to its corresponding type;
 *
 * @enum
 * @readonly
 */
const VersionType = {
  blockVersion: 0,
  transactionVersion: 1,
  createTokenTransactionVersion: 2,
  mergedMinedBlockVersion: 3,
  nanoContractTransaction: 4,
};

/**
 * Map version type to info that should assist on token list visualization.
 *
 * @readonly
 */
const VersionInfo = {
  [VersionType.blockVersion]: { symbol: 'b', label: t`Block` } ,
  [VersionType.transactionVersion]: { symbol: 'tx', label: t`Transaction` },
  [VersionType.createTokenTransactionVersion]: { symbol: 'tk', label: t`Create Token Transaction` },
  [VersionType.mergedMinedBlockVersion]: { symbol: 'mb', label: t`Merged Mined Block` },
  [VersionType.nanoContractTransaction]: { symbol: 'nc', label: t`Nano Contract Transaction` },
};

export class TxHistory {
  /**
   * @param {{
   *   txId: string;
   *   timestamp: number;
   *   tokenUid: string;
   *   balance: number;
   *   voided: boolean;
   *   processingStatus?: 'processing'|'finished';
   *   version: number;
   *   ncId?: string;
   *   ncMethod?: string;
   *   ncCaller?: Address;
   * }}
   */
  constructor({ txId, timestamp, tokenUid, balance, isVoided, version, processingStatus, ncId, ncMethod, ncCaller }) {
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
     * @type {'processing'|'finished'}
     */
    this.processingStatus = processingStatus
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
    return VersionInfo[this.version];
  }

  isNanoContract() {
    return this.version === VersionType.nanoContractTransaction;
  };

  /**
   * Creates a TxHistory instance from raw transaction history data.
   *
   * @param {{
   *   txId: string;
   *   balance: number;
   *   timestamp: number;
   *   voided: boolean;
   *   version: number;
   *   processingStatus: string;
   *   ncId?: string;
   *   ncMethod?: string;
   *   ncCaller?: Address;
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
      processingStatus,
      ncId,
      ncMethod,
      ncCaller,
    } = rawTxHistory;
    return new TxHistory({
      txId,
      timestamp,
      balance,
      version,
      processingStatus,
      ncId,
      ncMethod,
      ncCaller,
      tokenUid,
      // in wallet service this comes as 0/1 and in the full node comes with true/false
      isVoided: Boolean(rawTxHistory.voided),
    });
  }
}
