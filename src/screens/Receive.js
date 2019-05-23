import React from 'react';
import { SafeAreaView, StyleSheet, Text, TextInput, View } from 'react-native';
import { connect } from 'react-redux';

import QRCode from 'react-native-qrcode-svg';
import { NavigationEvents } from 'react-navigation';

import HathorButton from '../components/HathorButton';
import HathorTextInput from '../components/HathorTextInput';
import { clearInvoice, newInvoice } from '../hathorRedux';
import { getNoDecimalsAmount } from '../utils';

//const hathorLib = require('@hathor/wallet-lib');

class _ReceiveScreen extends React.Component {
  constructor(props) {
    super(props);
    this.state = {address: "", amount: null};
  }

  onGenerateInvoicePress = () => {
    this.props.dispatch(newInvoice(this.state.address, getNoDecimalsAmount(this.state.amount)));
    this.props.navigation.navigate('ReceiveScreenModal');
  }

  render() {
    return (
      <SafeAreaView style={{ flex: 1, justifyContent: "", alignItems: "center" }}>
        <NavigationEvents
          //TODO get new address everytime we go to Send screen?
          onWillFocus={payload => this.setState({address: global.hathorLib.wallet.getAddressToUse()})}
        />
        <Text style={[styles.text16, {marginTop: 24}]}>Your address</Text>
        <Text style={[styles.text16, {marginTop: 16}]} selectable={true}>{this.state.address}</Text>
        <HathorButton
          style={{marginBottom: 48, fontSize: 14}}
          onPress={() => this.setState({address: global.hathorLib.wallet.getAddressToUse()})}
          title="(Generate new address)"
        />
        <Text style={styles.text16}>Amount</Text>
        <Text style={styles.text16}>(optional)</Text>
        <HathorTextInput
          style={{fontSize: 24, width: 120, padding: 12, marginTop: 16}}
          onChangeText={(text) => this.setState({amount: parseFloat(text)})}
          placeholder="0.00"
          keyboardType="numeric"
          returnKeyType="done"
        />
        <HathorButton
          style={{marginTop: 48}}
          onPress={this.onGenerateInvoicePress}
          title="Create payment request"
        />
      </SafeAreaView>
    )
  }
}

const ReceiveScreen = connect(null)(_ReceiveScreen);

const mapInvoiceStateToProps = (state) => ({
  address: state.invoice.address,
  amount: state.invoice.amount,
  payment: state.invoicePayment,
})

class _ReceiveScreenModal extends React.Component {
  componentWillUnmount() {
    console.log('invoice willUnmount');
    this.props.dispatch(clearInvoice());
  }

  render() {
    return (
      //TODO dismiss button and clear invoice data when exiting (redux clearInvoice())
      <SafeAreaView style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
        <Text>Invoice!</Text>
        {this.props.payment && <Text>Paid at {this.props.payment.timestamp}</Text>}
        <QRCode
          value={JSON.stringify({address: `hathor:${this.props.address}`, amount: (this.props.amount || null)})}
          size={200}
        />
        <Text selectable={true}>{this.props.address}</Text>
        <Text>{`Amount: ${this.props.amount ? global.hathorLib.helpers.prettyValue(this.props.amount) : "not set"}`}</Text>
      </SafeAreaView>
    );
  }
}

const styles = StyleSheet.create({
  text16: {
    fontSize: 16,
  },
});

const ReceiveScreenModal = connect(mapInvoiceStateToProps)(_ReceiveScreenModal)

export { ReceiveScreen, ReceiveScreenModal };
