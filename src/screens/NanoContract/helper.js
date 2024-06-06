/**
 * Copyright (c) Hathor Labs and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { t } from 'ttag';
import { NANOCONTRACT_REGISTER_STATUS } from '../../constants';

export const feedbackSucceedText = t`Contract successfully registered.`;

/**
 * Check if the nano contract register status is successful.
 * @param {object} status - status from redux store
 * @returns {boolean} - true if the status is successful, false otherwise
 */
export const hasSucceeded = (status) => (
  status === NANOCONTRACT_REGISTER_STATUS.SUCCESSFUL
);

/**
 * Check if the nano contract register status is failed.
 * @param {object} status - status from redux store
 * @returns {boolean} - true if the status is failed, false otherwise
 */
export const hasFailed = (status) => (
  status === NANOCONTRACT_REGISTER_STATUS.FAILED
);

/**
 * Check if the nano contract register status is loading.
 * @param {object} status - status from redux store
 * @returns {boolean} - true if the status is loading, false otherwise
 */
export const isLoading = (status) => (
  status === NANOCONTRACT_REGISTER_STATUS.LOADING
);

/**
 * Check if the nano contract register status is not ready.
 * @param {object} status - status from redux store
 * @returns {boolean} - true if the status is not ready, false otherwise
 */
export const notReady = (status) => (
  status !== NANOCONTRACT_REGISTER_STATUS.READY
);
