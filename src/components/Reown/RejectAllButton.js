/**
 * Copyright (c) Hathor Labs and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import React from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { useNavigation } from '@react-navigation/native';
import { t } from 'ttag';
import {
  reownReject,
  reownRejectAllPendingRequests,
} from '../../actions';
import NewHathorButton from '../NewHathorButton';

/**
 * "Reject All Pending" button shown on dApp request detail screens
 * when there are multiple pending requests queued up.
 * Rejects the current request and batch-rejects all remaining ones.
 *
 * @param {Object} props
 * @param {Function} [props.onRejectAction] - Custom reject callback for the
 *   current request. Falls back to dispatching reownReject().
 */
export const RejectAllButton = ({ onRejectAction }) => {
  const dispatch = useDispatch();
  const navigation = useNavigation();
  const pendingCount = useSelector(
    (state) => state.reown.pendingRequests.length
  );

  if (pendingCount <= 1) {
    return null;
  }

  const onRejectAll = () => {
    // Reject the current request
    if (onRejectAction) {
      onRejectAction();
    } else {
      dispatch(reownReject());
    }
    // Batch-reject all remaining pending requests
    dispatch(reownRejectAllPendingRequests());
    navigation.goBack();
  };

  return (
    <NewHathorButton
      title={t`Reject All Pending (${pendingCount})`}
      onPress={onRejectAll}
      secondary
      danger
    />
  );
};
