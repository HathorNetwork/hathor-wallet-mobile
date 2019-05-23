import React from 'react';
import { SafeAreaView, Text, View } from 'react-native';

import QRCodeScanner from 'react-native-qrcode-scanner';

import HathorButton from '../components/HathorButton';
import HathorTextInput from '../components/HathorTextInput';
import { getDecimalsAmount, getNoDecimalsAmount } from '../utils';


class SendScreenModal extends React.Component {
  constructor(props) {
    super(props);
    const address = this.props.navigation.getParam("address", null);
    let amount = this.props.navigation.getParam("amount", null);
    if (amount) {
      amount = getDecimalsAmount(amount).toString();
    }
    this.state = {address, amount, error: null};
  }

  sendTx = () => {
    this.setState({error: null});
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
        this.setState({error: 'Error connecting to the network'});
      });
    } else {
      console.log('prepareSend false', ret.message);
      this.setState({error: ret.message});
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
        <View style={{flexDirection: "row", justifyContent: "space-between", marginBottom: 24}}>
          <View style={{flex: 1}}></View>
          <Text style={{flex: 3, textAlign: "center", fontSize: 24}}>Send tokens</Text>
          {/* TODO proper button icon */}
          <HathorButton
            style={{fontSize: 14}}
            onPress={() => this.props.navigation.goBack()}
            title="close"
          />
        </View>
        <View style={{flex: 1, marginTop: 32, justifyContent: "", alignItems: "center"}}>
          <View style={{flexDirection: "row"}}>
            <HathorTextInput
              style={{flex: 1, maxWidth: 330, marginHorizontal: 10}}
              placeholder="Address"
              autoCorrect={false}
              autoCapitalize="none"
              returnKeyType="done"
              autoFocus={true}
              clearButtonMode="while-editing"
              onChangeText={(text) => this.setState({address: text})}
              value={this.state.address}
            />
          </View>
          <HathorTextInput
            style={{fontSize: 24, width: 120, padding: 12, marginTop: 24}}
            placeholder="0.00"
            keyboardType="numeric"
            returnKeyType="done"
            onChangeText={this.onAmountChange}
            value={this.state.amount}
          />
          <HathorButton
            style={{marginTop: 32}}
            onPress={() => this.sendTx()}
            title={!this.state.error ? "Send" : "Try again"}
            disabled={!(this.state.address && this.state.amount)}
          />
          { this.state.error && <Text>Send error: {this.state.error}</Text> }
        </View>
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
          <HathorButton
            onPress={() => this.props.navigation.navigate('SendModal')}
            title="Enter info manually"
          />
        }
      />
    );
  }
}

export { SendScreen, SendScreenModal };
