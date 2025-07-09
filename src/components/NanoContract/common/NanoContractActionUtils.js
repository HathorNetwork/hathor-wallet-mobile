/**
 * Copyright (c) Hathor Labs and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { t } from 'ttag';
import { NanoContractActionType } from '@hathor/wallet-lib';
import { getShortHash } from '../../../utils';
import { DEFAULT_TOKEN } from '../../../constants';

/**
 * It returns the title template for each action type,
 * which includes 'deposit', 'withdrawal', 'grant_authority', and 'acquire_authority'.
 *
 * @param {string} tokenSymbol The token symbol fetched from metadata,
 * or a shortened token hash.
 *
 * @returns {string} A title template by action type.
 */
export const actionTitleMap = (tokenSymbol) => ({
  [NanoContractActionType.DEPOSIT]: t`${tokenSymbol} Deposit`,
  [NanoContractActionType.WITHDRAWAL]: t`${tokenSymbol} Withdrawal`,
  [NanoContractActionType.GRANT_AUTHORITY]: t`${tokenSymbol} Grant Authority`,
  [NanoContractActionType.ACQUIRE_AUTHORITY]: t`${tokenSymbol} Acquire Authority`,
});

/**
 * Get action title depending on the action type.
 * @param {Object} tokens A map of token metadata by token uid
 * @param {Object} action An action object
 * @param {string} action.type The action type
 * @param {string} action.token The token UID (for Reown components)
 * @param {string} action.uid The token UID (for NanoContract components)
 * @param {string} action.authority The authority type (mint/melt)
 *
 * @returns {string} A formatted title to be used in the action card
 */
export const getActionTitle = (tokens, action) => {
  // Support both 'token' (Reown) and 'uid' (NanoContract) field names
  const tokenUid = action.token || action.uid;
  const tokenMetadata = tokens[tokenUid];
  let tokenSymbol;

  if (tokenMetadata) {
    tokenSymbol = tokenMetadata.symbol;
  } else if (tokenUid === DEFAULT_TOKEN.uid) {
    tokenSymbol = DEFAULT_TOKEN.symbol;
  } else {
    tokenSymbol = getShortHash(tokenUid);
  }

  // For authority actions, include the authority type in the title
  if (action.type === NanoContractActionType.GRANT_AUTHORITY
    || action.type === NanoContractActionType.ACQUIRE_AUTHORITY) {
    const baseTitle = actionTitleMap(tokenSymbol)[action.type];
    return action.authority ? `${baseTitle}: ${action.authority}` : baseTitle;
  }

  return actionTitleMap(tokenSymbol)[action.type];
};

/**
 * Check if an action is an authority action (grant or acquire)
 * @param {string} actionType The action type
 * @returns {boolean} True if it's an authority action
 */
export const isAuthorityAction = (actionType) => (
  actionType === NanoContractActionType.GRANT_AUTHORITY
  || actionType === NanoContractActionType.ACQUIRE_AUTHORITY
);

/**
 * Split authority title for display (title on left, authority type on right)
 * @param {string} title The formatted title
 * @returns {string[]|null} Array of [baseTitle, authorityType] or null if no split needed
 */
export const splitAuthorityTitle = (title) => (
  title.includes(':') ? title.split(':').map((part) => part.trim()) : null
);
