/**
 * Copyright (c) Hathor Labs and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import React from 'react';
import { Image, StyleSheet } from 'react-native';
import { useDispatch, useSelector } from 'react-redux';
import { t } from 'ttag';
import FeedbackModal from '../FeedbackModal';
import Spinner from '../Spinner';
import { multichainConnectUpdate } from '../../actions';
import { CONNECT_STATUS } from '../../multichain/state';
import errorIcon from '../../assets/images/icErrorBig.png';

/**
 * What turning "Connect to side chain" on shows: a blocking "Connecting to Hathor Next…" while it
 * connects, and why it failed if it did. A passkey ceremony shows its own sheet, so nothing shows
 * while it runs.
 */
export function ConnectFeedback() {
  const dispatch = useDispatch();
  const { status, error } = useSelector((state) => state.multichain.connect);

  if (status === CONNECT_STATUS.CONNECTING) {
    return <FeedbackModal icon={<Spinner />} text={t`Connecting to Hathor Next…`} />;
  }
  if (status === CONNECT_STATUS.FAILED) {
    return (
      <FeedbackModal
        icon={<Image source={errorIcon} style={styles.icon} resizeMode='contain' />}
        text={error}
        onDismiss={() => dispatch(multichainConnectUpdate({ status: CONNECT_STATUS.IDLE }))}
      />
    );
  }
  return null;
}

const styles = StyleSheet.create({
  icon: {
    height: 105,
    width: 105,
  },
});
