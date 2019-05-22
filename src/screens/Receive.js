import React from 'react';
import { Button, Clipboard, SafeAreaView, Text, TextInput, View } from 'react-native';
import { connect } from 'react-redux';

import QRCode from 'react-native-qrcode-svg';
import { NavigationEvents } from 'react-navigation';

import { newInvoice } from '../hathorRedux';
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
      <SafeAreaView style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
        <NavigationEvents
          //TODO get new address everytime we go to Send screen?
          onWillFocus={payload => this.setState({address: global.hathorLib.wallet.getAddressToUse()})}
        />
        <Text>Receive!</Text>
        <Text>{this.state.address}</Text>
        <Button
          onPress={() => Clipboard.setString(this.state.address)}
          title="Copy to clipboard"
        />
        <Button
          onPress={() => this.setState({address: global.hathorLib.wallet.getAddressToUse()})}
          title="Generate new address"
        />
        <Text>Amount (optional):</Text>
        <TextInput
          style={{height: 40, borderColor: 'gray', borderWidth: 1}}
          onChangeText={(text) => this.setState({amount: parseFloat(text)})}
          placeholder="0.00"
          keyboardType="numeric"
        />
        <Button
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
})

const _ReceiveScreenModal = props => {
  return (
    //TODO dismiss button and clear invoice data when exiting (redux clearInvoice())
    <SafeAreaView style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
      <Text>Invoice!</Text>
      <QRCode
        value={JSON.stringify({address: `hathor:${props.address}`, amount: (props.amount || null)})}
        size={200}
      />
      <Text>{`Address: ${props.address}`}</Text>
      <Text>{`Amount: ${props.amount ? global.hathorLib.helpers.prettyValue(props.amount) : "not set"}`}</Text>
    </SafeAreaView>
  );
}

const ReceiveScreenModal = connect(mapInvoiceStateToProps)(_ReceiveScreenModal)

export { ReceiveScreen, ReceiveScreenModal };
