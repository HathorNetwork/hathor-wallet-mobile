/**
 * Copyright (c) Hathor Labs and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import React, { Component } from 'react';
import {
  Text,
  StyleSheet,
  View,
  ScrollView,
} from 'react-native';
import { t } from 'ttag';

import { getShortContent, getShortHash, getTokenLabel, renderValue } from '../utils';
import { ListItem } from './HathorList';
import SlideIndicatorBar from './SlideIndicatorBar';
import CopyClipboard from './CopyClipboard';
import { PublicExplorerListButton } from './PublicExplorerListButton';
import { COLORS } from '../styles/themes';
import { TransactionStatusLabel } from './TransactionStatusLabel';
import BackdropModal from './BackdropModal';

class TxDetailsModal extends Component {
  style = StyleSheet.create({
    container: {
      paddingHorizontal: 8,
      paddingTop: 96,
    },
    inner: {
      borderRadius: 8,
      paddingBottom: 24,
      backgroundColor: COLORS.backgroundColor,
      maxHeight: '80%',
    },
  });

  getCopyClipboard = ({ text, copyText }) => (
    <CopyClipboard
      text={text}
      copyText={copyText}
      textStyle={{ fontSize: 16 }}
    />
  );

  getFeeModelText = (version) => {
    if (version === 0) {
      return t`Native Token`;
    } else if (version === 1) {
      return t`Deposit Based`;
    } else if (version === 2) {
      return t`Fee Based`;
    }
    return null;
  };

  render() {
    /**
     * @type {{
     *   token: unknown;
     *   tx: TxHistory;
     *   isNFT: boolean;
     * }} TxDetailsModal properties
     */
    const { token, tx, isNFT } = this.props;
    const { txId, ncId, ncMethod, ncCaller, isVoided } = tx;
    const ncCallerAddr = ncCaller && ncCaller.base58;

    const fullTokenStr = getTokenLabel(token);
    const description = tx.getDescription(token);
    const timestampStr = tx.getTimestampFormat();
    const shortTxId = getShortHash(txId, 7);
    const shortNcId = ncId && getShortHash(ncId, 7);
    const shortNcCallerAddr = ncCallerAddr && getShortContent(ncCallerAddr, 7);
    const txIdComponent = this.getCopyClipboard({
      text: shortTxId,
      copyText: txId
    });
    const ncIdComponent = ncId && this.getCopyClipboard({
      text: shortNcId,
      copyText: ncId
    });
    const ncCallerAddrComponent = ncCaller && this.getCopyClipboard({
      text: shortNcCallerAddr,
      copyText: ncCallerAddr
    });
    const isNc = tx.isNanoContract();
    const hasFirstBlock = tx.hasFirstBlock();
    const feeModelText = this.getFeeModelText(token?.version);

    return (
      <BackdropModal
        visible
        animationType='slide'
        position='bottom'
        enableSwipeToDismiss
        enableBackdropPress
        onDismiss={this.props.onRequestClose}
        containerStyle={this.style.container}
        contentStyle={this.style.inner}
        swipeThreshold={100}
      >
        <SlideIndicatorBar />
        <BalanceView tx={tx} token={token} isNFT={isNFT} />
        <ScrollView>
          <View>
            <ListItem title={t`Token`} text={fullTokenStr} />
            <ListItem title={t`Description`} text={description} />
            <ListItem title={t`Date & Time`} text={timestampStr} />
            {feeModelText && <ListItem title={t`Fee Model`} text={feeModelText} />}
            <ListItem title={t`Transaction ID`} text={txIdComponent} />
            {isNc && (
              <ListItem
                title={t`Nano Contract Status`}
                text={(
                  <TransactionStatusLabel
                    isVoided={isVoided}
                    hasFirstBlock={hasFirstBlock}
                  />
                )}
              />
            )}
            {isNc && <ListItem title={t`Blueprint Method`} text={ncMethod} />}
            {isNc && <ListItem title={t`Nano Contract ID`} text={ncIdComponent} />}
            {isNc && <ListItem title={t`Nano Contract Caller`} text={ncCallerAddrComponent} />}
            {isNc && <PublicExplorerListButton txId={shortNcId} title={t`Nano Contract`} />}
            <PublicExplorerListButton txId={tx.txId} />
          </View>
        </ScrollView>
      </BackdropModal>
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
