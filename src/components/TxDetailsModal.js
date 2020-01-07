/**
 * Copyright (c) Hathor Labs and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import React, { Component } from 'react';
import { Text, StyleSheet, View } from 'react-native';
import Modal from 'react-native-modal';
import { t } from 'ttag';

import hathorLib from '@hathor/wallet-lib';
import { getShortHash, getTokenLabel } from '../utils';
import { ListItem } from './HathorList';
import SlideIndicatorBar from './SlideIndicatorBar';

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
    const { token, tx } = this.props;
    const fullTokenStr = getTokenLabel(token);
    const description = tx.getDescription(token);
    const timestampStr = tx.getTimestampFormat();
    const idStr = getShortHash(tx.txId, 12);
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
            <BalanceView tx={tx} token={token} />
            <View>
              <ListItem title={t`Token`} text={fullTokenStr} />
              <ListItem title={t`Description`} text={description} />
              <ListItem title={t`Date & Time`} text={timestampStr} />
              <ListItem title={t`ID`} text={idStr} isLast />
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
    const { tx } = this.props;
    const balanceStr = hathorLib.helpers.prettyValue(tx.balance);
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
