/**
 * Copyright (c) Hathor Labs and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import React from 'react';
import { StyleSheet, Image, View, Text } from 'react-native';
import { useDispatch } from 'react-redux';
import { t } from 'ttag';
import FeedbackModal from '../FeedbackModal';
import NewHathorButton from '../NewHathorButton';
import { hideReownModal } from '../../actions';
import errorIcon from '../../assets/images/icErrorBig.png';
import { COLORS } from '../../styles/themes';

/**
 * Modal displayed when there is a network mismatch between the wallet and dApp
 *
 * @param {Object} props
 * @param {Object} props.data - The modal data
 * @param {string} props.data.walletNetwork - The wallet's current network
 * @param {string[]} props.data.dappNetworks - The networks requested by the dApp
 */
export const NetworkMismatchModal = ({ data }) => {
  const dispatch = useDispatch();

  const handleDismiss = () => {
    dispatch(hideReownModal());
  };

  const walletNetwork = data?.walletNetwork || 'unknown';
  const dappNetworks = data?.dappNetworks || [];

  return (
    <FeedbackModal
      icon={<Image source={errorIcon} style={styles.icon} resizeMode='contain' />}
      text={t`Network Mismatch`}
      onDismiss={handleDismiss}
      action={(
        <View style={styles.container}>
          <Text style={styles.description}>
            {t`The dApp requires a different network than your wallet is connected to.`}
          </Text>
          <View style={styles.networkInfo}>
            <Text style={styles.networkLabel}>{t`Your wallet:`}</Text>
            <Text style={styles.networkValue}>{walletNetwork}</Text>
          </View>
          <View style={styles.networkInfo}>
            <Text style={styles.networkLabel}>{t`dApp requires:`}</Text>
            <Text style={styles.networkValue}>{dappNetworks.join(', ') || 'unknown'}</Text>
          </View>
          <NewHathorButton title={t`Close`} onPress={handleDismiss} />
        </View>
      )}
    />
  );
};

const styles = StyleSheet.create({
  icon: {
    width: 48,
    height: 48,
  },
  container: {
    width: '100%',
    gap: 16,
  },
  description: {
    fontSize: 14,
    color: COLORS.textColor,
    textAlign: 'center',
  },
  networkInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
  },
  networkLabel: {
    fontSize: 14,
    color: COLORS.textColorShadow,
  },
  networkValue: {
    fontSize: 14,
    fontWeight: 'bold',
    color: COLORS.textColor,
  },
});

export default NetworkMismatchModal;
