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

import { getShortHash, renderValue } from '../utils';
import { ListItem } from './HathorList';
import SlideIndicatorBar from './SlideIndicatorBar';
import CopyClipboard from './CopyClipboard';
import { PublicExplorerListButton } from './PublicExplorerListButton';
import { COLORS } from '../styles/themes';
import BackdropModal from './BackdropModal';
import TxFeesRow from './TxFeesRow';
import AuditUnblindingRows from './AuditUnblindingRows';
import { getTxFees } from '../shielded/fees';
import FitText from './FitText';

class TxDetailsModal extends Component {
  /**
   * fees {Object|null} The fees of the tx, once loaded
   */
  state = {
    fees: null,
  };

  /**
   * Whether the modal is still open, so the fees that load after it closes are dropped.
   */
  isOpen = false;

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

  componentDidMount() {
    this.isOpen = true;
    this.loadFees();
  }

  componentWillUnmount() {
    this.isOpen = false;
  }

  /**
   * Loads the fees of the tx, whoever paid them. The history has no fees: the fullnode lists
   * them. Where the shielded UI doesn't show (props.showPrivacyFee), the privacy fee counts in
   * the network fee.
   */
  async loadFees() {
    const { showPrivacyFee, wallet, tx } = this.props;
    if (!wallet) {
      return;
    }
    const fees = await getTxFees(wallet, tx.txId, showPrivacyFee ? tx.privacyFee : 0n);
    if (this.isOpen && fees) {
      this.setState({ fees });
    }
  }

  render() {
    /**
     * @type {{
     *   token: unknown;
     *   tx: TxHistory;
     *   isNFT: boolean;
     *   wallet?: HathorWallet;
     *   showPrivacyFee?: boolean;
     *   nativeSymbol?: string;
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
        {/* The amount, and under it whether the tx sent or received it. */}
        <BalanceView
          tx={tx}
          token={token}
          isNFT={isNFT}
          description={description}
          amountFormat={this.props.amountFormat}
          decimalPlaces={this.props.decimalPlaces}
        />
        <ScrollView>
          <View>
            <ListItem title={t`Date & Time`} text={timestampStr} />
            {this.state.fees && (
              <TxFeesRow
                fees={this.state.fees}
                symbol={this.props.nativeSymbol}
                decimalPlaces={this.props.decimalPlaces}
                amountFormat={this.props.amountFormat}
              />
            )}
            <ListItem title={t`Transaction ID`} text={txIdComponent} />
            <PublicExplorerListButton txId={tx.txId} />
            <AuditUnblindingRows
              txId={tx.txId}
              hasShieldedActivity={tx.hasShieldedActivity}
            />
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
    const { tx, isNFT, description, amountFormat, decimalPlaces } = this.props;
    const balanceStr = renderValue(tx.balance, isNFT, decimalPlaces, amountFormat);
    return (
      <View style={this.style.view}>
        <FitText style={this.style.balance}>
          {`${balanceStr} ${this.props.token.symbol}`}
        </FitText>
        <Text style={this.style.description}>{description}</Text>
      </View>
    );
  }
}

export default TxDetailsModal;
