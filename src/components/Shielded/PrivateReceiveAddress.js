/**
 * Copyright (c) Hathor Labs and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import React, { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { t } from 'ttag';
import { useDispatch, useSelector } from 'react-redux';

import SimpleButton from '../SimpleButton';
import Spinner from '../Spinner';
import ShieldedUnlockAction from './ShieldedUnlockAction';
import { walletRefreshSharedAddress } from '../../actions';
import { WALLET_STATUS } from '../../sagas/wallet';
import {
  RECEIVE_REASON_ERROR,
  SHIELDED_RECEIVE_STATUS,
  receiveReasonText,
  selectShieldedReceive,
} from '../../shielded/receiveState';
import { COLORS } from '../../styles/themes';

/**
 * The wallet's private (shielded) receive address: the children, which show it as the shared
 * address, once the wallet gives it out; otherwise where it stands: locked, with the action that
 * unlocks it, unavailable, with why, or loading. When the address couldn't be read, for an error
 * nothing expects, a ready wallet also offers to read it again. It never shows the legacy
 * address in its place.
 *
 * @param {Object} props
 * @param {{ navigate: Function }} props.navigation Opens the PIN screen of the unlock
 * @param {React.ReactNode} props.children The address, shown once the wallet gives it out
 */
export default function PrivateReceiveAddress({ navigation, children }) {
  const dispatch = useDispatch();
  const receive = useSelector(selectShieldedReceive);
  const walletReady = useSelector((state) => state.walletStartState === WALLET_STATUS.READY);

  // The state may be from before the shielded UI turned on: read it again when Receive opens.
  useEffect(() => {
    if (walletReady) {
      dispatch(walletRefreshSharedAddress());
    }
  }, []);

  switch (receive.status) {
    case SHIELDED_RECEIVE_STATUS.READY:
      return children;
    case SHIELDED_RECEIVE_STATUS.LOCKED:
      return (
        <Notice
          title={t`Private receiving is locked`}
          body={t`Unlock your private balance to receive private payments and see your private funds.`}
        >
          <ShieldedUnlockAction navigation={navigation} />
        </Notice>
      );
    case SHIELDED_RECEIVE_STATUS.UNAVAILABLE:
      return (
        <Notice
          title={t`Private receiving is unavailable`}
          body={receiveReasonText(receive.reason)}
        >
          {receive.reason === RECEIVE_REASON_ERROR && walletReady && (
            <SimpleButton
              title={t`Retry`}
              textStyle={styles.action}
              onPress={() => dispatch(walletRefreshSharedAddress())}
            />
          )}
        </Notice>
      );
    default:
      return (
        <View style={styles.centered}>
          <Spinner size={48} />
        </View>
      );
  }
}

/**
 * Why there's no private address to show, and what to do about it.
 *
 * @param {Object} props
 * @param {string} props.title
 * @param {string} props.body
 * @param {React.ReactNode} [props.children] The action, if any
 */
const Notice = ({ title, body, children }) => (
  <View style={[styles.centered, styles.notice]}>
    <Text style={styles.noticeTitle}>{title}</Text>
    <Text style={styles.noticeBody}>{body}</Text>
    {children}
  </View>
);

const styles = StyleSheet.create({
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.backgroundColor,
  },
  notice: {
    paddingHorizontal: 32,
  },
  noticeTitle: {
    fontSize: 16,
    lineHeight: 24,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  noticeBody: {
    marginTop: 8,
    marginBottom: 16,
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
    color: COLORS.textColorShadow,
  },
  action: {
    fontWeight: 'bold',
  },
});
