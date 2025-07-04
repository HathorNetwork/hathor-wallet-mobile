/**
 * Copyright (c) Hathor Labs and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import React from 'react';
import {
  StyleSheet, Text, View,
} from 'react-native';
import { connect } from 'react-redux';
import { t } from 'ttag';
import { get } from 'lodash';

import QRCode from 'react-native-qrcode-svg';

import HathorHeader from '../components/HathorHeader';
import ModalConfirmation from '../components/ModalConfirmation';
import OfflineBar from '../components/OfflineBar';
import TextFmt from '../components/TextFmt';
import { clearInvoice } from '../actions';
import { getTokenLabel, renderValue, isTokenNFT } from '../utils';
import NavigationService from '../NavigationService';
import { COLORS } from '../styles/themes';

/**
 * address {string} Invoice destination address
 * amount {number} Invoice amount
 * token {Object} Invoice token config
 * payment {Object} Transaction with the invoice payment
 * tokenMetadata {Object} metadata of tokens
 */
const mapInvoiceStateToProps = (state) => ({
  address: state.latestInvoice.address,
  amount: state.latestInvoice.amount,
  token: state.latestInvoice.token,
  payment: state.invoicePayment,
  wallet: state.wallet,
  tokenMetadata: state.tokenMetadata,
});

class PaymentRequestDetail extends React.Component {
  constructor(props) {
    super(props);

    this.modalConfirmation = React.createRef();
  }

  async componentDidMount() {
    // When we create a new payment request, we don't update the address for a new one
    // This will only happen when it receives a transaction and becomes a used address
    await this.props.wallet.getCurrentAddress();
  }

  componentDidUpdate(prevProps) {
    if (prevProps.payment === null && this.props.payment !== null) {
      if (this.modalConfirmation.current) {
        this.modalConfirmation.current.show();
      }
    }
  }

  componentWillUnmount() {
    this.props.dispatch(clearInvoice());
  }

  /**
   * If the payment was not yet received, the user goes back to the "Select Amount" screen.
   * Otherwise, goes directly to the Home screen to see the updated wallet.
   */
  onBackClick() {
    if (this.props.payment !== null) {
      NavigationService.resetToMain();
    } else {
      this.props.navigation.goBack();
    }
  }

  render() {
    const { symbol } = this.props.token;
    const isNFT = isTokenNFT(get(this.props, 'token.uid'), this.props.tokenMetadata);

    const renderModalBody = () => {
      const amount = renderValue(this.props.amount, isNFT);
      return (
        <TextFmt style={{ fontSize: 18 }}>
          {t`You've just received **${amount} ${symbol}**`}
        </TextFmt>
      );
    };

    const renderPaymentConfirm = () => (
      <ModalConfirmation
        body={renderModalBody()}
        ref={this.modalConfirmation}
      />
    );

    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        {renderPaymentConfirm()}
        <HathorHeader
          withBorder
          title={t`PAYMENT REQUEST`}
          onBackPress={() => this.onBackClick()}
        />
        <View style={{
          flex: 1, justifyContent: 'space-between', alignItems: 'center', width: '100%',
        }}
        >
          <View style={{
            flex: 1, justifyContent: 'center', alignItems: 'center', width: '100%',
          }}
          >
            <QRCode
              value={JSON.stringify({
                address: `hathor:${this.props.address}`,
                // amount is a bigint, so we need to stringify it as
                // it is not serializable
                amount: this.props.amount.toString(),
                token: this.props.token
              })}
              size={200}
            />
          </View>
          <View style={{ alignItems: 'center', width: '100%' }}>
            <View style={styles.dataWrapper}>
              <Text style={styles.title}>{t`Token`}</Text>
              <Text style={styles.data}>{getTokenLabel(this.props.token)}</Text>
            </View>
            <View style={styles.dataWrapper}>
              <Text style={styles.title}>{t`Amount`}</Text>
              <Text style={styles.data}>
                {renderValue(this.props.amount, isNFT)}
                {' '}
                {symbol}
              </Text>
            </View>
            <View style={styles.dataWrapper}>
              <Text style={styles.title}>{t`My Address`}</Text>
              <Text numberOfLines={1} style={styles.data}>{this.props.address}</Text>
            </View>
            <View style={styles.dataWrapper}>
              <Text style={styles.title}>{t`Status`}</Text>
              <Text style={styles.data}>{this.props.payment ? t`Received` : t`Waiting confirmation`}</Text>
            </View>
          </View>
          <OfflineBar />
        </View>
      </View>
    );
  }
}

const styles = StyleSheet.create({
  dataWrapper: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderColor: COLORS.borderColor,
    height: 64,
    width: '100%',
  },
  title: {
    fontSize: 14,
    opacity: 0.5,
  },
  data: {
    fontSize: 16,
    marginLeft: 16,
    textAlign: 'right',
    flex: 1,
  },
});

export default connect(mapInvoiceStateToProps)(PaymentRequestDetail);
