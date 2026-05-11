/**
 * Copyright (c) Hathor Labs and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import React, { useEffect, useState } from 'react';
import {
  Dimensions, Share, StyleSheet, View,
} from 'react-native';
import { t } from 'ttag';
import QRCode from 'react-native-qrcode-svg';
import { useDispatch, useSelector } from 'react-redux';

import SimpleButton from './SimpleButton';
import CopyClipboard from './CopyClipboard';
import { sharedAddressUpdate } from '../actions';
import { COLORS } from '../styles/themes';
import { SHIELDED_OUTPUTS_FEATURE_TOGGLE, FEATURE_TOGGLE_DEFAULTS } from '../constants';

export default function ReceiveMyAddress() {
  const dispatch = useDispatch();
  const wallet = useSelector((state) => state.wallet);
  const lastSharedAddress = useSelector((state) => state.lastSharedAddress);
  const shieldedEnabled = useSelector(
    (state) => state.featureToggles[SHIELDED_OUTPUTS_FEATURE_TOGGLE]
      ?? FEATURE_TOGGLE_DEFAULTS[SHIELDED_OUTPUTS_FEATURE_TOGGLE]
  );
  const [displayAddress, setDisplayAddress] = useState(null);

  // When shielded is enabled, derive the shielded address for the current index.
  // When disabled, fall back to the legacy lastSharedAddress without deriving.
  useEffect(() => {
    if (!lastSharedAddress || !wallet || !shieldedEnabled) {
      setDisplayAddress(null);
      return undefined;
    }
    let cancelled = false;
    const derive = async () => {
      try {
        const info = await wallet.getCurrentAddress({}, { legacy: false });
        if (!cancelled) setDisplayAddress(info.address);
      } catch (e) {
        if (!cancelled) setDisplayAddress(null);
      }
    };
    derive();
    return () => { cancelled = true; };
  }, [shieldedEnabled, lastSharedAddress, wallet]);

  const addressToShow = displayAddress || lastSharedAddress;

  const getNextAddress = async () => {
    const { address, index } = await wallet.getNextAddress({ legacy: !shieldedEnabled });
    dispatch(sharedAddressUpdate(address, index));
  };

  const shareAddress = () => {
    Share.share({
      message: t`Here is my address: ${addressToShow}`,
    });
  };

  if (!lastSharedAddress) {
    return null;
  }

  const { height } = Dimensions.get('window');

  return (
    <View style={styles.wrapper}>
      <View style={styles.qrcodeWrapper}>
        <QRCode value={`hathor:${addressToShow}`} size={height < 650 ? 160 : 250} />
      </View>
      <View style={styles.addressWrapper}>
        <CopyClipboard
          text={addressToShow}
          textStyle={{ fontSize: height < 650 ? 11 : 13 }}
        />
      </View>
      <View style={styles.buttonRow}>
        <SimpleButton
          title={t`New address`}
          onPress={getNextAddress}
          containerStyle={[styles.buttonContainer, styles.leftButtonBorder]}
        />
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
