/**
 * Copyright (c) Hathor Labs and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import React, { Component } from 'react';
import { Text, StyleSheet, View, ScrollView, TouchableWithoutFeedback } from 'react-native';
import Modal from 'react-native-modal';
import { t } from 'ttag';

import { getShortContent, getShortHash, getTokenLabel, renderValue } from '../utils';
import { ListItem } from './HathorList';
import SlideIndicatorBar from './SlideIndicatorBar';
import CopyClipboard from './CopyClipboard';
import { PublicExplorerListButton } from './PublicExplorerListButton';
import { COLORS } from '../styles/themes';
import { TxHistory } from '../models';
import { TransactionStatusLabel } from './TransactionStatusLabel.component';

class TxDetailsModal extends Component {
  style = StyleSheet.create({
    modal: {
      justifyContent: 'flex-end',
      marginVertical: 0,
      marginHorizontal: 0,
    },
    wrapper: {
      flex: 1,
      paddingTop: 96,
      paddingHorizontal: 8,
    },
    inner: {
      flexShrink: 1,
      marginTop: 'auto',
      borderRadius: 8,
      paddingBottom: 24,
      backgroundColor: COLORS.backgroundColor,
    },
  });

  getCopyClipboard = ({ text, copyText }) => (
    <CopyClipboard
      text={text}
      copyText={copyText}
      textStyle={{ fontSize: 16 }}
    />
  );

  getTxStatus = (processingStatus, isVoided) => (
    <TransactionStatusLabel processingStatus={processingStatus} isVoided={isVoided} />
  );

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
    const shortTxId = getShortHash(tx.txId, 7);
    const txStatus = this.getTxStatus(tx.processingStatus, tx.isVoided);
    const ncMethod = tx.ncMethod;
    const shortNcId = tx.ncId && getShortHash(tx.ncId, 7);
    const shortNcCallerAddr = tx.ncCaller && getShortContent(tx.ncCaller.base58, 7);
    const txId = this.getCopyClipboard({ text: shortTxId, copyText: tx.txId });
    const ncId = tx.ncId && this.getCopyClipboard({ text: shortNcId, copyText: tx.ncId });
    const ncCallerAddr = tx.ncCaller && this.getCopyClipboard({ text: shortNcCallerAddr, copyText: tx.ncCaller.base58 });
    return (
      <Modal
        isVisible
        animationIn='slideInUp'
        swipeDirection={['down']}
        onSwipeComplete={this.props.onRequestClose}
        onBackButtonPress={this.props.onRequestClose}
        onBackdropPress={this.props.onRequestClose}
        style={this.style.modal}
        propagateSwipe={true}
      >
        <View style={this.style.wrapper}>
          <View style={this.style.inner}>
            <SlideIndicatorBar />
            <BalanceView tx={tx} token={token} isNFT={isNFT} />
            <ScrollView>
              <TouchableWithoutFeedback>
                <View>
                  <ListItem title={t`Token`} text={fullTokenStr} />
                  <ListItem title={t`Description`} text={description} />
                  <ListItem title={t`Date & Time`} text={timestampStr} />
                  <ListItem title={t`Transaction ID`} text={txId} />
                  {tx.isNanoContract() &&
                    <>
                      <ListItem title={t`Blueprint Method`} text={ncMethod} />
                      <ListItem title={t`Nano Contract ID`} text={ncId} />
                      <ListItem title={t`Nano Contract Caller`} text={ncCallerAddr} />
                      <ListItem title={t`Status`} text={txStatus} />
                      <PublicExplorerListButton txId={shortNcId} title={t`Nano Contract`} />
                    </>
                  }
                  <PublicExplorerListButton txId={tx.txId} isLast />
                </View>
              </TouchableWithoutFeedback>
            </ScrollView>
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
