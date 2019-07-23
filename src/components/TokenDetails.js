/**
 * Copyright (c) Hathor Labs and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import React from 'react';
import {
  Share, StyleSheet, Text, View, ViewPropTypes,
} from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import PropTypes from 'prop-types';

import hathorLib from '@hathor/wallet-lib';
import { getTokenLabel } from '../utils';
import SimpleButton from './SimpleButton';
import CopyClipboard from './CopyClipboard';


const TokenDetails = (props) => {
  const tokenLabel = getTokenLabel(props.token);

  const configString = hathorLib.tokens.getConfigurationString(
    props.token.uid, props.token.name, props.token.symbol
  );

  const shareClicked = () => {
    Share.share({
      message: `Here is the configuration string of token ${tokenLabel}: ${configString}`,
    });
  };

  return (
    <View style={[styles.contentWrapper, props.contentStyle]}>
      <View style={styles.tokenWrapper}>
        <Text style={{ fontSize: 14, lineHeight: 17, fontWeight: 'bold' }}>{tokenLabel}</Text>
      </View>
      <View style={styles.qrcodeWrapper}>
        <QRCode
          value={configString}
          size={200}
        />
      </View>
      <View style={styles.configStringWrapper}>
        <CopyClipboard
          text={configString}
          textStyle={{ fontSize: 14, color: 'rgba(0, 0, 0, 0.5)' }}
        />
      </View>
      <View style={styles.buttonWrapper}>
        <SimpleButton
          title='Share'
          onPress={shareClicked}
          color='#000'
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
    backgroundColor: 'white',
    alignItems: 'center',
    justifyContent: 'flex-start',
    borderRadius: 16,
    shadowOffset: { height: 2, width: 0 },
    shadowRadius: 4,
    shadowColor: 'black',
    shadowOpacity: 0.08,
  },
  tokenWrapper: {
    marginVertical: 24,
    alignItems: 'center',
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
    borderColor: '#eee',
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
