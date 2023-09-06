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
import { sharedAddressUpdate } from '../actions';

export default function ReceiveMyAddress() {
  const dispatch = useDispatch();
  const wallet = useSelector((state) => state.wallet);
  const lastSharedAddress = useSelector((state) => state.lastSharedAddress);

  const getNextAddress = async () => {
    // Fetch the address but do not mark it as used yet.
    const { address, index } = await wallet.getCurrentAddress();

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

  // This is used to set the width of the address wrapper view
  // For some reason I was not being able to set as 100%, so I had to use this
  const { height, width } = Dimensions.get('window');

  const addressWrapperStyle = StyleSheet.create({
    style: {
      padding: 16,
      borderBottomWidth: 1.5,
      borderTopWidth: 1.5,
      borderColor: '#e5e5ea',
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      width: width - 32,
    },
  });

  return (
    <View style={styles.wrapper}>
      <View style={styles.qrcodeWrapper}>
        <QRCode value={`hathor:${lastSharedAddress}`} size={height < 650 ? 160 : 250} />
      </View>
      <View style={addressWrapperStyle.style}>
        <CopyClipboard
          text={lastSharedAddress}
          textStyle={{ fontSize: height < 650 ? 11 : 13 }}
        />
      </View>
      <View style={{ flexDirection: 'row' }}>
        <SimpleButton
          title={t`New address`}
          onPress={getNextAddress}
          containerStyle={[styles.buttonContainer, styles.leftButtonBorder]}
        />
        <SimpleButton
          onPress={shareAddress}
          title={t`Share`}
          color='#000'
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
    marginHorizontal: 16,
    marginTop: 32,
    borderWidth: 1.5,
    borderColor: '#e5e5ea',
    borderRadius: 8,
    marginBottom: 32,
    backgroundColor: 'white', // Ensures maximum contrast for the code readers
  },
  qrcodeWrapper: {
    padding: 24,
    flex: 1,
  },
  buttonContainer: {
    flex: 1,
    alignSelf: 'stretch',
    alignItems: 'center',
    paddingVertical: 16,
  },
  leftButtonBorder: {
    borderRightWidth: 1.5,
    borderColor: '#eee',
  },
});
