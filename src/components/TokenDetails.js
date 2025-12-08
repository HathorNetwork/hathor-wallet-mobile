/**
 * Copyright (c) Hathor Labs and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import React from 'react';
import {
  Share, StyleSheet, Text, View,
} from 'react-native';
import { t } from 'ttag';
import QRCode from 'react-native-qrcode-svg';
import PropTypes from 'prop-types';
import { ViewPropTypes } from 'deprecated-react-native-prop-types';

import hathorLib from '@hathor/wallet-lib';
import { getTokenLabel } from '../utils';
import SimpleButton from './SimpleButton';
import CopyClipboard from './CopyClipboard';
import { COLORS } from '../styles/themes';

const TokenDetails = (props) => {
  const tokenLabel = getTokenLabel(props.token);

  const configString = hathorLib.tokensUtils.getConfigurationString(
    props.token.uid,
    props.token.name,
    props.token.symbol
  );

  const shareClicked = () => {
    Share.share({
      message: t`Here is the configuration string of token ${tokenLabel}: ${configString}`,
    });
  };

  const renderNFTType = () => (
    props.isNFT && '- NFT'
  );

  const getFeeModelInfo = () => {
    const version = props.token?.version;

    if (version === 0) {
      return {
        model: t`Native Token`,
        description: t`This is the native token, no fees applies.`,
      };
    } else if (version === 1) {
      return {
        model: t`Fee Model: Deposit-Based`,
        description: t`No transaction fees. Requires 1% HTR deposit.`,
      };
    } else if (version === 2) {
      return {
        model: t`Fee Model: Fee-Based`,
        description: t`Small fee applies to each transfer. No deposit required.`,
      };
    }

    return null;
  };

  const renderFeeModel = () => {
    const feeModelInfo = getFeeModelInfo();

    if (!feeModelInfo) {
      return null;
    }

    return (
      <View style={styles.feeModelWrapper}>
        <Text style={styles.feeModelLabel}>{feeModelInfo.model}</Text>
        <Text style={styles.feeModelDescription}>{feeModelInfo.description}</Text>
      </View>
    );
  };

  return (
    <View style={[styles.contentWrapper, props.contentStyle]}>
      <View style={styles.tokenWrapper}>
        <Text style={{ fontSize: 14, lineHeight: 17, fontWeight: 'bold' }}>{tokenLabel} {renderNFTType()}</Text>
      </View>
      {renderFeeModel()}
      <View style={styles.qrcodeWrapper}>
        <QRCode
          value={configString}
          size={200}
        />
      </View>
      <View style={styles.configStringWrapper}>
        <CopyClipboard
          text={configString}
          textStyle={{ fontSize: 14, color: COLORS.textColorShadow }}
        />
      </View>
      <View style={styles.buttonWrapper}>
        <SimpleButton
          title={t`Share`}
          onPress={shareClicked}
          color={COLORS.textColor}
          containerStyle={styles.simpleButtonContainer}
        />
      </View>
    </View>
  );
};

TokenDetails.propTypes = {
  // extra styles for wrapper
  contentStyle: ViewPropTypes.style,

  // Token to display
  token: PropTypes.shape({
    uid: PropTypes.string,
    name: PropTypes.string,
    symbol: PropTypes.string,
  }).isRequired,
};

const styles = StyleSheet.create({
  contentWrapper: {
    backgroundColor: COLORS.backgroundColor,
    alignItems: 'center',
    justifyContent: 'flex-start',
    borderRadius: 16,
    shadowOffset: { height: 2, width: 0 },
    shadowRadius: 4,
    shadowColor: COLORS.textColor,
    shadowOpacity: 0.08,
  },
  tokenWrapper: {
    marginVertical: 24,
    alignItems: 'center',
  },
  feeModelWrapper: {
    backgroundColor: COLORS.lowContrastDetail,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    marginBottom: 24,
    alignSelf: 'stretch',
    marginHorizontal: 24,
    alignItems: 'center',
  },
  feeModelLabel: {
    fontSize: 12,
    fontWeight: 'bold',
    color: COLORS.textColor,
    marginBottom: 4,
  },
  feeModelDescription: {
    fontSize: 11,
    color: COLORS.textColorShadow,
    textAlign: 'center',
  },
  qrcodeWrapper: {
    alignSelf: 'stretch',
    alignItems: 'center',
  },
  configStringWrapper: {
    height: 100,
    padding: 24,
    alignSelf: 'stretch',
    alignItems: 'center',
    justifyContent: 'center',
    borderBottomWidth: 1,
    borderColor: COLORS.borderColor,
  },
  buttonWrapper: {
    borderRadius: 8,
    alignSelf: 'stretch',
    alignItems: 'center',
  },
  simpleButtonContainer: {
    paddingVertical: 24,
    alignSelf: 'stretch',
    alignItems: 'center'
  },
});

export default TokenDetails;
