import React from 'react';
import { Button, SafeAreaView, Text, TextInput, View } from 'react-native';

import QRCodeScanner from 'react-native-qrcode-scanner';

import { getFullAmount } from '../utils';

//const hathorLib = require('@hathor/wallet-lib');

class InfoSendScreen extends React.Component {
  constructor(props) {
    super(props);
    this.state = {address: this.props.address, amount: this.props.amount};
  }

  sendTx = () => {
    const value = getFullAmount(this.state.amount);
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

  render() {
    return (
      <SafeAreaView style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
        <Text>Send information!</Text>
        <TextInput
          style={{height: 40, borderColor: 'gray', borderWidth: 1}}
          onChangeText={(text) => this.setState({address: text})}
          placeholder="Address"
          autoCorrect={false}
        />
        <TextInput
          style={{height: 40, borderColor: 'gray', borderWidth: 1}}
          onChangeText={(text) => this.setState({amount: parseFloat(text)})}
          placeholder="0.00"
          keyboardType="numeric"
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
