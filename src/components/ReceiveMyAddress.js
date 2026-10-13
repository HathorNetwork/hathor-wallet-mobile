/**
 * Copyright (c) Hathor Labs and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import React from 'react';
import {
  Dimensions, Share, StyleSheet, View,
} from 'react-native';
import { t } from 'ttag';
import QRCode from 'react-native-qrcode-svg';
import { useDispatch, useSelector } from 'react-redux';

import SimpleButton from './SimpleButton';
import CopyClipboard from './CopyClipboard';
import PrivateReceiveAddress from './Shielded/PrivateReceiveAddress';
import { sharedAddressUpdate, walletRefreshSharedAddress } from '../actions';
import { ADDRESS_MODE } from '../constants';
import { isShieldedEnvironment } from '../shielded/gating';
import { COLORS } from '../styles/themes';

/**
 * The wallet's receive address. Where the shielded UI is on, it is the wallet's new (shielded)
 * address alone, which PrivateReceiveAddress shows once the wallet gives it out; elsewhere, its
 * legacy address.
 *
 * @param {Object} props
 * @param {{ navigate: Function }} props.navigation
 */
export default function ReceiveMyAddress({ navigation }) {
  const shieldedEnvironment = useSelector(isShieldedEnvironment);

  if (!shieldedEnvironment) {
    return <SharedAddress />;
  }

  return (
    <PrivateReceiveAddress navigation={navigation}>
      <SharedAddress shielded />
    </PrivateReceiveAddress>
  );
}

/**
 * The wallet's shared address (lastSharedAddress), with its QR code, copy, share and, in
 * multi-address mode, a new address. In the shielded environment the shared address is the
 * wallet's current shielded address.
 *
 * @param {Object} props
 * @param {boolean} [props.shielded] Whether the shared address is the shielded one
 */
function SharedAddress({ shielded = false }) {
  const dispatch = useDispatch();
  const wallet = useSelector((state) => state.wallet);
  const lastSharedAddress = useSelector((state) => state.lastSharedAddress);
  const addressMode = useSelector((state) => state.addressMode);

  const getNextAddress = async () => {
    if (shielded) {
      await wallet.getNextAddress({ legacy: false });
      // The refresh shares the address the wallet gives out now, with its receive state, and
      // keeps a refresh that started before from sharing the address this one replaced.
      dispatch(walletRefreshSharedAddress());
      return;
    }

    const { address, index } = await wallet.getNextAddress();

    dispatch(sharedAddressUpdate(address, index));
  };

  const shareAddress = () => {
    Share.share({
      message: t`Here is my address: ${lastSharedAddress}`,
    });
  };

  if (!lastSharedAddress) {
    return null;
  }

  const { height } = Dimensions.get('window');

  return (
    <View style={styles.wrapper}>
      <View style={styles.qrcodeWrapper}>
        <QRCode value={`hathor:${lastSharedAddress}`} size={height < 650 ? 160 : 250} />
      </View>
      <View style={styles.addressWrapper}>
        <CopyClipboard
          text={lastSharedAddress}
          textStyle={{ fontSize: height < 650 ? 11 : 13 }}
        />
      </View>
      <View style={styles.buttonRow}>
        {addressMode !== ADDRESS_MODE.SINGLE && (
          <SimpleButton
            title={t`New address`}
            onPress={getNextAddress}
            containerStyle={[styles.buttonContainer, styles.leftButtonBorder]}
          />
        )}
        <SimpleButton
          onPress={shareAddress}
          title={t`Share`}
          color={COLORS.textColor}
          containerStyle={styles.buttonContainer}
        />
      </View>
    </View>
  );
}

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
  leftButtonBorder: {
    borderRightWidth: 1.5,
    borderColor: COLORS.borderColor,
  },
});
