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

import { getShortHash, getTokenLabel, renderValue } from '../utils';
import { ListItem } from './HathorList';
import SlideIndicatorBar from './SlideIndicatorBar';
import CopyClipboard from './CopyClipboard';
import { PublicExplorerListButton } from './PublicExplorerListButton';
import { COLORS } from '../styles/themes';
import { TxHistory } from '../models';

class TxDetailsModal extends Component {
  style = StyleSheet.create({
    modal: {
      justifyContent: 'flex-end',
    },
    inner: {
      backgroundColor: COLORS.backgroundColor,
      borderRadius: 8,
    },
  });

  render() {
    /**
     * @type {{
     *   token: unknown;
     *   tx: TxHistory;
     *   isNFT: boolean;
     * }} TxDetailsModal properties
     */
    const { token, tx, isNFT } = this.props;
    const fullTokenStr = getTokenLabel(token);
    const description = tx.getDescription(token);
    const timestampStr = tx.getTimestampFormat();
    const idStr = getShortHash(tx.txId, 12);
    const txIdComponent = (
      <CopyClipboard
        text={idStr}
        copyText={tx.txId}
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
              {tx.isNanoContract() &&
                <>
                  <ListItem title={t`Nano Contract ID`} text={tx.ncId} />
                  <ListItem title={t`Nano Contract Method`} text={tx.ncMethod} />
                  <ListItem title={t`Nano Contract Caller`} text={tx.ncCaller?.base58} />
                </>
              }
              <PublicExplorerListButton txId={tx.txId} />
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
      color: COLORS.textColorShadow,
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
