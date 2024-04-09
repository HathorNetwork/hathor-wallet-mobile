import { t } from 'ttag';
import { NETWORKSETTINGS_STATUS } from '../../constants';

export const feedbackLoadingText = t`Updating custom network settings...`;
export const feedbackSucceedText = t`Network settings successfully customized.`;
export const feedbackFailedText = t`There was an error while customizing network settings. Please try again later.`;

/**
 * Check if the network settings status is successful.
 * @param {object} networkSettingsStatus - status from redux store
 * @returns {boolean} - true if the status is successful, false otherwise
 */
export function hasSucceeded(networkSettingsStatus) {
  return networkSettingsStatus === NETWORKSETTINGS_STATUS.SUCCESSFUL;
}

/**
 * Check if the network settings status is failed.
 * @param {object} networkSettingsStatus - status from redux store
 * @returns {boolean} - true if the status is failed, false otherwise
 */
// eslint-disable-next-line max-len
export const hasFailed = (networkSettingsStatus) => networkSettingsStatus === NETWORKSETTINGS_STATUS.FAILED;

/**
 * Check if the network settings status is loading.
 * @param {object} networkSettingsStatus - status from redux store
 * @returns {boolean} - true if the status is loading, false otherwise
 */
// eslint-disable-next-line max-len
export const isLoading = (networkSettingsStatus) => networkSettingsStatus === NETWORKSETTINGS_STATUS.LOADING;
