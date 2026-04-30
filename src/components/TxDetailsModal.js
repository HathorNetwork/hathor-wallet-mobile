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
  TouchableOpacity,
} from 'react-native';
import { t } from 'ttag';

import hathorLib from '@hathor/wallet-lib';
import { getShortHash, getTokenLabel, renderValue } from '../utils';
import { ListItem } from './HathorList';
import SlideIndicatorBar from './SlideIndicatorBar';
import CopyClipboard from './CopyClipboard';
import { PublicExplorerListButton } from './PublicExplorerListButton';
import { COLORS } from '../styles/themes';
import BackdropModal from './BackdropModal';
import { ChevronDownIcon } from './Icons/ChevronDown.icon';
import { ChevronUpIcon } from './Icons/ChevronUp.icon';

class TxDetailsModal extends Component {
  state = {
    isFeesExpanded: false,
  };

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
    // Match the visual contract of `ListItem` (used for the Date,
    // Transaction ID and Public Explorer rows): 64px tall row, 16px
    // horizontal padding, full-weight bottom border in
    // COLORS.borderColor. The label uses the muted "shadow" color and
    // 14pt; the right-hand value uses the primary color and 16pt.
    feeRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      height: 64,
      paddingLeft: 16,
      paddingRight: 16,
      borderColor: COLORS.borderColor,
      borderBottomWidth: 1,
    },
    // When the breakdown is open, the Fees row and its details read as
    // one cluster — no divider between them. The shared bottom border
    // moves down to the bottom of `feeBreakdown` (already in place).
    feeRowExpanded: {
      borderBottomWidth: 0,
    },
    feeRowLabel: {
      fontSize: 14,
      color: COLORS.textColorShadow,
    },
    feeRowValueWrapper: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
    },
    feeRowValue: {
      fontSize: 16,
      color: COLORS.textColor,
    },
    feeBreakdown: {
      paddingLeft: 16,
      paddingRight: 16,
      paddingVertical: 8,
      borderColor: COLORS.borderColor,
      borderBottomWidth: 1,
    },
    feeBreakdownRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      paddingVertical: 4,
    },
    feeBreakdownLabel: {
      fontSize: 13,
      color: COLORS.textColorShadow,
      // Small indent so the breakdown reads as a child of the Fees row
      // and not a peer of the other top-level rows.
      paddingLeft: 10,
    },
    feeBreakdownValue: {
      fontSize: 13,
      color: COLORS.textColorShadow,
    },
  });

  getCopyClipboard = ({ text, copyText }) => (
    <CopyClipboard
      text={text}
      copyText={copyText}
      textStyle={{ fontSize: 16 }}
    />
  );

  toggleFeesExpanded = () => {
    this.setState((prev) => ({ isFeesExpanded: !prev.isFeesExpanded }));
  };

  renderFeesRow(networkFee, privacyFee) {
    const totalFee = networkFee + privacyFee;
    if (totalFee <= 0n) return null;
    const nativeSymbol = hathorLib.constants.DEFAULT_NATIVE_TOKEN_CONFIG.symbol;
    return (
      <>
        <TouchableOpacity
          style={[
            this.style.feeRow,
            this.state.isFeesExpanded && this.style.feeRowExpanded,
          ]}
          onPress={this.toggleFeesExpanded}
          activeOpacity={0.6}
        >
          <Text style={this.style.feeRowLabel}>{t`Fees`}</Text>
          <View style={this.style.feeRowValueWrapper}>
            <Text style={this.style.feeRowValue}>
              {renderValue(totalFee, false)} {nativeSymbol}
            </Text>
            {this.state.isFeesExpanded
              ? <ChevronUpIcon size={16} color={COLORS.textColor} />
              : <ChevronDownIcon size={16} color={COLORS.textColor} />}
          </View>
        </TouchableOpacity>
        {this.state.isFeesExpanded && (
          <View style={this.style.feeBreakdown}>
            {networkFee > 0n && (
              <View style={this.style.feeBreakdownRow}>
                <Text style={this.style.feeBreakdownLabel}>{t`Network fee`}</Text>
                <Text style={this.style.feeBreakdownValue}>
                  {renderValue(networkFee, false)} {nativeSymbol}
                </Text>
              </View>
            )}
            {privacyFee > 0n && (
              <View style={this.style.feeBreakdownRow}>
                <Text style={this.style.feeBreakdownLabel}>{t`Privacy fee`}</Text>
                <Text style={this.style.feeBreakdownValue}>
                  {renderValue(privacyFee, false)} {nativeSymbol}
                </Text>
              </View>
            )}
          </View>
        )}
      </>
    );
  }

  render() {
    /**
     * @type {{
     *   token: unknown;
     *   tx: TxHistory;
     *   isNFT: boolean;
     * }} TxDetailsModal properties
     */
    const { token, tx, isNFT } = this.props;
    const { txId } = tx;

    const description = tx.getDescription(token);
    const timestampStr = tx.getTimestampFormat();
    const shortTxId = getShortHash(txId, 7);
    const txIdComponent = this.getCopyClipboard({
      text: shortTxId,
      copyText: txId,
    });

    // Fees are precomputed during TxHistory.from() so the modal works
    // identically against full-node and wallet-service history shapes
    // (the latter may strip the raw headers / shielded_outputs).
    const networkFee = tx?.networkFee ?? 0n;
    const privacyFee = tx?.privacyFee ?? 0n;

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
        {/* Hero amount + direction (Sent / Received). The previous
            modal labelled this row "Amount"; the redesign promotes the
            description (Sent / Received) into the subtitle slot so the
            user can immediately see the tx polarity. */}
        <BalanceView tx={tx} token={token} isNFT={isNFT} description={description} />
        <ScrollView>
          <View>
            <ListItem title={t`Date & Time`} text={timestampStr} />
            {this.renderFeesRow(networkFee, privacyFee)}
            <ListItem title={t`Transaction ID`} text={txIdComponent} />
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
    description: {
      paddingTop: 8,
      fontSize: 12,
      fontWeight: 'bold',
      color: COLORS.textColorShadow,
    },
  });

  render() {
    const { tx, isNFT, description } = this.props;
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
        <Text style={this.style.description}>{description}</Text>
      </View>
    );
  }
}

export default TxDetailsModal;
