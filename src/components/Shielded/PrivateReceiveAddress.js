/**
 * Copyright (c) Hathor Labs and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import React, { useEffect } from 'react';
import {
  Dimensions, Share, StyleSheet, Text, View,
} from 'react-native';
import { t } from 'ttag';
import QRCode from 'react-native-qrcode-svg';
import { useDispatch, useSelector } from 'react-redux';

import SimpleButton from '../SimpleButton';
import CopyClipboard from '../CopyClipboard';
import Spinner from '../Spinner';
import ShieldedUnlockAction from './ShieldedUnlockAction';
import { walletRefreshSharedAddress } from '../../actions';
import { WALLET_STATUS } from '../../sagas/wallet';
import {
  SHIELDED_RECEIVE_STATUS,
  receiveReasonText,
  selectShieldedReceive,
} from '../../shielded/receiveState';
import { COLORS } from '../../styles/themes';

/**
 * The wallet's private (shielded) receive address, or where it stands: locked, with the action
 * that unlocks it, unavailable, with why, or loading. It never shows the public address in its
 * place. It offers no new address: the wallet gives out its current shielded address, which
 * moves on once an output paid to it is decoded.
 *
 * @param {Object} props
 * @param {{ navigate: Function }} props.navigation Opens the PIN screen of the unlock
 */
export default function PrivateReceiveAddress({ navigation }) {
  const dispatch = useDispatch();
  const receive = useSelector(selectShieldedReceive);
  const walletReady = useSelector((state) => state.walletStartState === WALLET_STATUS.READY);

  // The state may be from before the shielded UI turned on: read it again when the tab opens.
  useEffect(() => {
    if (walletReady) {
      dispatch(walletRefreshSharedAddress());
    }
  }, []);

  switch (receive.status) {
    case SHIELDED_RECEIVE_STATUS.READY:
      return <PrivateAddress address={receive.address} />;
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
        />
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
 * The private address, with its QR code, copy and share.
 *
 * @param {Object} props
 * @param {string} props.address The wallet's current shielded address
 */
const PrivateAddress = ({ address }) => {
  const shareAddress = () => {
    Share.share({
      message: t`Here is my private address: ${address}`,
    });
  };

  const { height } = Dimensions.get('window');

  return (
    <View style={styles.wrapper}>
      <View style={styles.qrcodeWrapper}>
        <QRCode value={`hathor:${address}`} size={height < 650 ? 160 : 250} />
      </View>
      <View style={styles.addressWrapper}>
        <CopyClipboard
          text={address}
          textStyle={{ fontSize: height < 650 ? 11 : 13, textAlign: 'center' }}
        />
      </View>
      <Text style={styles.hint}>
        {t`Only wallets that support private transfers can pay this address.`}
      </Text>
      <View style={styles.buttonRow}>
        <SimpleButton
          onPress={shareAddress}
          title={t`Share`}
          color={COLORS.textColor}
          containerStyle={styles.buttonContainer}
        />
      </View>
    </View>
  );
};

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
  wrapper: {
    flex: 1,
    alignItems: 'center',
    backgroundColor: COLORS.backgroundColor,
  },
  qrcodeWrapper: {
    padding: 24,
    flex: 1,
    justifyContent: 'center',
  },
  addressWrapper: {
    padding: 16,
    borderTopWidth: 1.5,
    borderColor: COLORS.borderColor,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'stretch',
  },
  hint: {
    paddingHorizontal: 16,
    paddingBottom: 16,
    fontSize: 12,
    lineHeight: 16,
    textAlign: 'center',
    color: COLORS.textColorShadow,
  },
  buttonRow: {
    flexDirection: 'row',
    alignSelf: 'stretch',
    borderTopWidth: 1.5,
    borderBottomWidth: 1.5,
    borderColor: COLORS.borderColor,
  },
  buttonContainer: {
    flex: 1,
    alignSelf: 'stretch',
    alignItems: 'center',
    paddingVertical: 16,
  },
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
});
