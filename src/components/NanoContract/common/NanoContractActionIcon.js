/**
 * Copyright (c) Hathor Labs and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { NanoContractActionType } from '@hathor/wallet-lib';
import { ReceivedIcon } from '../../Icons/Received.icon';
import { SentIcon } from '../../Icons/Sent.icon';

/**
 * It renders an icon by action type: 'deposit', 'withdrawal', 'grant_authority',
 * or 'acquire_authority'.
 *
 * @param {Object} props
 * @param {'deposit'|'withdrawal'|'grant_authority'|'acquire_authority'} props.type Action type.
 */
export const NanoContractActionIcon = ({ type }) => {
  const iconMap = {
    [NanoContractActionType.DEPOSIT]: SentIcon({ type: 'default' }),
    [NanoContractActionType.WITHDRAWAL]: ReceivedIcon({ type: 'default' }),
    [NanoContractActionType.GRANT_AUTHORITY]: SentIcon({ type: 'default' }),
    [NanoContractActionType.ACQUIRE_AUTHORITY]: ReceivedIcon({ type: 'default' }),
  };

  return (iconMap[type]);
};

