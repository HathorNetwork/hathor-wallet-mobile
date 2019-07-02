import React from 'react';
import {
  SafeAreaView, StyleSheet, Text, View,
} from 'react-native';
import { connect } from 'react-redux';

import QRCode from 'react-native-qrcode-svg';

import hathorLib from '@hathor/wallet-lib';
import HathorHeader from '../components/HathorHeader';
import ModalConfirmation from '../components/ModalConfirmation';
import OfflineBar from '../components/OfflineBar';
import { clearInvoice } from '../actions';
import { getShortAddress, getTokenLabel } from '../utils';


/**
 * address {string} Invoice destination address
 * amount {number} Invoice amount
 * token {Object} Invoice token config
 * payment {Object} Transaction with the invoice payment
 */
const mapInvoiceStateToProps = state => ({
  address: state.latestInvoice.address,
  amount: state.latestInvoice.amount,
  token: state.latestInvoice.token,
  payment: state.invoicePayment,
});

class PaymentRequestDetail extends React.Component {
  constructor(props) {
    super(props);

    this.modalConfirmation = React.createRef();
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

  render() {
    const renderModalBody = () => (
      <Text style={{ fontSize: 18 }}>
          You've just received
        <Text style={{ fontWeight: 'bold' }}>
          {` ${hathorLib.helpers.prettyValue(this.props.amount)} ${this.props.token.symbol}`}
        </Text>
      </Text>
    );

    const renderPaymentConfirm = () => (
      <ModalConfirmation
        body={renderModalBody()}
        ref={this.modalConfirmation}
      />
    );

    return (
      <SafeAreaView style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        {renderPaymentConfirm()}
        <HathorHeader title="PAYMENT REQUEST" onBackPress={() => this.props.navigation.goBack()} />
        <View style={{
          flex: 1, justifyContent: 'space-between', alignItems: 'center', width: '100%',
        }}
        >
          <View style={{
            flex: 1, justifyContent: 'center', alignItems: 'center', width: '100%',
          }}
          >
            <QRCode
              value={JSON.stringify({ address: `hathor:${this.props.address}`, amount: this.props.amount, token: this.props.token })}
              size={200}
            />
          </View>
          <View style={{ alignItems: 'center', width: '100%' }}>
            <View style={styles.dataWrapper}>
              <Text style={styles.title}>Token</Text>
              <Text style={styles.data}>{getTokenLabel(this.props.token)}</Text>
            </View>
            <View style={styles.dataWrapper}>
              <Text style={styles.title}>Amount</Text>
              <Text style={styles.data}>
                {hathorLib.helpers.prettyValue(this.props.amount)}
                {' '}
                {this.props.token.symbol}
              </Text>
            </View>
            <View style={styles.dataWrapper}>
              <Text style={styles.title}>My Address</Text>
              <Text numberOfLines={1} style={styles.data}>{this.props.address}</Text>
            </View>
            <View style={styles.dataWrapper}>
              <Text style={styles.title}>Status</Text>
              <Text style={styles.data}>{this.props.payment ? 'Received' : 'Waiting confirmation'}</Text>
            </View>
          </View>
          <OfflineBar />
        </View>
      </SafeAreaView>
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
    borderColor: '#eee',
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
