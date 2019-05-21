import React from 'react';
import { Button, SafeAreaView, Text, TextInput, View } from 'react-native';

import QRCodeScanner from 'react-native-qrcode-scanner';

import { getDecimalsAmount, getNoDecimalsAmount } from '../utils';

//const hathorLib = require('@hathor/wallet-lib');

class InfoSendScreen extends React.Component {
  constructor(props) {
    super(props);
    const address = this.props.navigation.getParam("address", null);
    let amount = this.props.navigation.getParam("amount", null);
    if (amount) {
      amount = getDecimalsAmount(amount).toString();
    }
    this.state = {address, amount};
  }

  sendTx = () => {
    const value = getNoDecimalsAmount(parseFloat(this.state.amount));
    const data = {};
    data.tokens = [];
    data.inputs = [];
    data.outputs = [{address: this.state.address, value: value, timelock: null, tokenData: 0}];
    const walletData = global.hathorLib.wallet.getWalletData();
    const historyTransactions = 'historyTransactions' in walletData ? walletData['historyTransactions'] : {};
    const ret = global.hathorLib.wallet.prepareSendTokensData(data, global.hathorLib.constants.HATHOR_TOKEN_CONFIG, true, historyTransactions, []);
    if (ret.success) {
      global.hathorLib.transaction.sendTransaction(ret.data, '123456').then(() => {
        this.props.navigation.goBack();
      }, (error) => {
        console.log('tx send error', error);
        this.props.navigation.goBack();
      });
    } else {
      console.log('prepareSend false', ret.message);
    }
  }

  onAmountChange = text => {
    // we force at most 2 decimal places
    //TODO can use ',' as decimal separator?
    parts = text.split(".");
    if (parts[1]) {
      if (parts[1].length > 2) return;
    }
    this.setState({amount: text});
  }

  render() {
    return (
      <SafeAreaView style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
        <Text>Send information!</Text>
        <TextInput
          style={{height: 40, borderColor: 'gray', borderWidth: 1}}
          placeholder="Address"
          autoCorrect={false}
          autoCapitalize="none"
          onChangeText={(text) => this.setState({address: text})}
          value={this.state.address}
        />
        <TextInput
          style={{height: 40, width: 100, borderColor: 'gray', borderWidth: 1}}
          placeholder="0.00"
          keyboardType="numeric"
          onChangeText={this.onAmountChange}
          value={this.state.amount}
        />
        <Button
          onPress={() => this.sendTx()}
          title="Send"
          disabled={!(this.state.address && this.state.amount)}
        />
      </SafeAreaView>
    )
  }
}


class SendScreen extends React.Component {
  constructor(props) {
    super(props);
    //this.state = { words: global.hathorLib.wallet.generateWalletWords(global.hathorLib.constants.HD_WALLET_ENTROPY) };
  }

  onSuccess = (e) => {
    console.log('qr code', e.data);
    try {
      const qrcode = JSON.parse(e.data);
      const hathorAddress = qrcode.address;
      const addressParts = hathorAddress.split(":");
      if (addressParts[0] !== "hathor") {
        throw new Error('not a hathor address');
      }
      const address = addressParts[1];
      const amount = qrcode.amount;
      this.props.navigation.navigate("SendModal", {address, amount});
    } catch (e) {
      //TODO error message to user
      ;
    }
  }

  render() {
    return (
      <QRCodeScanner
        onRead={this.onSuccess}
        showMarker={true}
        topContent={
          <Text>Scan the QR code with the transaction info.</Text>
        }
        bottomContent={
          <Button
            onPress={() => this.props.navigation.navigate('SendModal')}
            title="Enter info manually"
          />
        }
      />
    );
  }
}

export { SendScreen, InfoSendScreen };
