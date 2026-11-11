/**
 * Copyright (c) Hathor Labs and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import React from 'react';
import {
  Dimensions, Share, StyleSheet, Text, View,
} from 'react-native';
import { useSelector } from 'react-redux';
import { t } from 'ttag';
import QRCode from 'react-native-qrcode-svg';
import CopyClipboard from '../CopyClipboard';
import SimpleButton from '../SimpleButton';
import { receiveReuseBody } from '../../multichain/content';
import { COLORS } from '../../styles/themes';

/**
 * The wallet's Hathor Next address, laid out as Hathor Network's Receive: one address, reusable
 * forever, so there is no "New address". The QR code holds the address itself, which already
 * starts with its scheme (`samba:`).
 */
export function NextReceiveAddress() {
  const address = useSelector((state) => state.multichain.next.address);

  if (!address) {
    return null;
  }

  const { height } = Dimensions.get('window');
  const shareAddress = () => {
    Share.share({
      message: t`Here is my Hathor Next address: ${address}`,
    });
  };

  return (
    <View style={styles.wrapper}>
      <View style={styles.qrcodeWrapper}>
        <QRCode value={address} size={height < 650 ? 160 : 250} />
      </View>
      <View style={styles.note}>
        <Text style={styles.noteText}>{receiveReuseBody()}</Text>
      </View>
      <View style={styles.addressWrapper}>
        <CopyClipboard
          text={address}
          textStyle={{ fontSize: height < 650 ? 11 : 13 }}
        />
      </View>
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
  note: {
    alignSelf: 'stretch',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingBottom: 16,
  },
  noteText: {
    fontSize: 13,
    lineHeight: 18,
    textAlign: 'center',
    color: COLORS.textColorShadow,
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
});
