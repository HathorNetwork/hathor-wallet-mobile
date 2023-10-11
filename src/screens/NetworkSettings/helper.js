import { t } from 'ttag';
import { NETWORKSETTINGS_STATUS } from "../../constants";

export const feedbackLoadingText = t`Updating custom network settings...`;
export const feedbackFailedText = t`There was an error while customizing network settings. Please try again later.`;

/**
 * Check if the network settings status is failed.
 * @param {object} networkSettingsStatus - status from redux store
 * @returns {boolean} - true if the status is failed, false otherwise
 */
export const hasFailed = (networkSettingsStatus) => {
  return networkSettingsStatus === NETWORKSETTINGS_STATUS.FAILED;
};

/**
 * Check if the network settings status is loading.
 * @param {object} networkSettingsStatus - status from redux store
 * @returns {boolean} - true if the status is loading, false otherwise
 */
export const isLoading = (networkSettingsStatus) => {
  return networkSettingsStatus === NETWORKSETTINGS_STATUS.LOADING;
};

