/**
 * Copyright (c) Hathor Labs and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import React, { Component } from 'react';
import { Image, Linking, Text, StyleSheet, View } from 'react-native';
import Modal from 'react-native-modal';
import { t } from 'ttag';

import { getShortHash, getTokenLabel, renderValue } from '../utils';
import { ListButton, ListItem } from './HathorList';
import SlideIndicatorBar from './SlideIndicatorBar';
import icShareActive from '../assets/icons/icShareActive.png';
import CopyClipboard from './CopyClipboard';

class TxDetailsModal extends Component {
  style = StyleSheet.create({
    modal: {
      justifyContent: 'flex-end',
    },
    inner: {
      backgroundColor: '#fff',
      borderRadius: 8,
    },
  });

  render() {
    const { token, tx, isNFT } = this.props;
    const fullTokenStr = getTokenLabel(token);
    const description = tx.getDescription(token);
    const timestampStr = tx.getTimestampFormat();
    const idStr = getShortHash(tx.txId, 12);
    const explorerIcon = <Image source={icShareActive} width={24} height={24} />;
    const explorerLink = `https://explorer.hathor.network/transaction/${tx.txId}`;
    const txIdComponent = (
      <CopyClipboard
        text={idStr}
        copyText={tx.txId}
        copiedTimeout={800}
        textStyle={{ fontSize: 16 }}
      />
    );
    return (
      <Modal
        isVisible
        animationIn='slideInUp'
        swipeDirection={['down']}
        onSwipeComplete={this.props.onRequestClose}
        onBackButtonPress={this.props.onRequestClose}
        onBackdropPress={this.props.onRequestClose}
        style={this.style.modal}
      >
        <View>
          <View style={this.style.inner}>
            <SlideIndicatorBar />
            <BalanceView tx={tx} token={token} isNFT={isNFT} />
            <View>
              <ListItem title={t`Token`} text={fullTokenStr} />
              <ListItem title={t`Description`} text={description} />
              <ListItem title={t`Date & Time`} text={timestampStr} />
              <ListItem title={t`ID`} text={txIdComponent} />
              <ListButton title={t`Public Explorer`} button={explorerIcon} onPress={() => { Linking.openURL(explorerLink); }} titleStyle={{ color: 'rgba(0, 0, 0, 0.5)' }} isLast />
            </View>
          </View>
        </View>
      </Modal>
    );
  }
}

class BalanceView extends Component {
  style = StyleSheet.create({
    view: {
      marginTop: 32,
      marginBottom: 32,
      alignItems: 'center',
      paddingLeft: 54,
      paddingRight: 54,
    },
    balance: {
      fontSize: 32,
      fontWeight: 'bold',
    },
    text1: {
      paddingTop: 8,
      fontSize: 12,
      fontWeight: 'bold',
      color: 'rgba(0, 0, 0, 0.5)',
    },
  });

  render() {
    const { tx, isNFT } = this.props;
    const balanceStr = renderValue(tx.balance, isNFT);
    return (
      <View style={this.style.view}>
        <Text
          style={this.style.balance}
          adjustsFontSizeToFit
          minimumFontScale={0.5}
          numberOfLines={1}
        >
          {`${balanceStr} ${this.props.token.symbol}`}
        </Text>
        <Text style={this.style.text1}>{t`Amount`}</Text>
      </View>
    );
  }
}

export default TxDetailsModal;
