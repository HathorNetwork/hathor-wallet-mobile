import React from 'react';
import { ActivityIndicator, Alert, SafeAreaView, Text, View } from 'react-native';

import ModalTop from '../components/ModalTop';
import QRCodeReader from '../components/QRCodeReader';
import HathorButton from '../components/HathorButton';
import HathorTextInput from '../components/HathorTextInput';
import { getDecimalsAmount, getNoDecimalsAmount, getAmountParsed, getTokenLabel } from '../utils';
import { sendTx, sendTxDismiss } from '../actions';
import { connect } from 'react-redux';

import hathorLib from '@hathor/wallet-lib';


/**
 * selected {Object} Selected token config {name, symbol, uid}
 * loading {boolean} Indicates tx send is being processed (display spinner)
 * error {String} Error message for send operation
 */
const mapStateToProps = (state) => {
  return {
    selected: state.selectedToken,
    loading: state.sendTx.loading,
    error: state.sendTx.error,
  };
}

const mapDispatchToProps = dispatch => {
  return {
    sendTxDismiss: () => dispatch(sendTxDismiss()),
    sendTx: (amount, address, token, pin, onSuccess) => dispatch(sendTx(amount, address, token, pin, onSuccess)),
  }
}

class _SendScreenModal extends React.Component {
  constructor(props) {
    super(props);
    const address = this.props.navigation.getParam("address", null);
    let amount = this.props.navigation.getParam("amount", null);
    if (amount) {
      amount = getDecimalsAmount(amount).toString();
    }
    // If qrcode was read, token is the one from it, else it's the one from redux
    const token = this.props.navigation.getParam("token", null) || this.props.selected;
    this.state = {address, amount, token};
  }

  componentWillUnmount() {
    this.props.sendTxDismiss();
  }

  onAmountChange = text => {
    this.setState({ amount: getAmountParsed(text) });
  }

  onSendPress = () => {
    const params = {
      cb: this.executeSend,
      canCancel: true,
      screenText: 'Enter your 6-digit pin to authorize operation',
      biometryText: 'Authorize operation',
    };
    this.props.navigation.navigate('PinScreen', params);
  }

  executeSend = (pinCode) => {
    const amount = getNoDecimalsAmount(parseFloat(this.state.amount.replace(',', '.')));
    console.log('token', this.state.token, this.state);
    this.props.sendTx(amount, this.state.address, this.state.token, pinCode, this.props.navigation.goBack);
  }

  render() {
    return (
      <SafeAreaView style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
        <ModalTop title='Send tokens' navigation={this.props.navigation} />
        <View style={{flex: 1, marginTop: 32, alignItems: "center", justifyContent: "flex-start"}}>
          <View style={{ flexDirection: "row" }}>
            <Text style={{ fontWeight: "bold", fontSize: 16 }}>Token to send: </Text>
            <Text style={{ fontSize: 16 }}>{getTokenLabel(this.state.token)}</Text>
          </View>
          <View style={{flexDirection: "row", marginTop: 32 }}>
            <HathorTextInput
              style={{flex: 1, maxWidth: 330, marginHorizontal: 10}}
              placeholder="Address"
              autoCorrect={false}
              autoCapitalize="none"
              returnKeyType="done"
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
            onPress={this.onSendPress}
            title="Send"
            disabled={!(this.state.address && this.state.amount) || this.props.loading}
          />
          <Text style={{marginTop: 16, color: "red"}}>{this.props.error}</Text>
          <ActivityIndicator size="small" animating={this.props.loading} />
        </View>
      </SafeAreaView>
    )
  }
}

const SendScreenModal = connect(mapStateToProps, mapDispatchToProps)(_SendScreenModal);


class SendScreen extends React.Component {
  constructor(props) {
    super(props);

    this.QRCodeReader = null;
  }

  showAlertError = (message) => {
    Alert.alert(
      "Invalid QR code",
      message,
      [
        {text: "OK", onPress: this.QRCodeReader.reactivateQrCodeScanner},
      ],
      {cancelable: false},
    );
  }

  onSuccess = (e) => {
    let hathorAddress;
    let qrcode;
    try {
      qrcode = JSON.parse(e.data);
      if (!('address' in qrcode) || !('token' in qrcode)) {
        this.showAlertError("Qrcode must contain token and address data");
        return;
      }
      hathorAddress = qrcode.address;
    } catch (error) {
      // if it's not json, maybe it's just the address from wallet ("hathor:{address}")
      hathorAddress = e.data;
    }
    const addressParts = hathorAddress.split(":");
    if (addressParts[0] !== "hathor" || addressParts.length !== 2) {
      this.showAlertError("This QR code does not contain a Hathor address or payment request.");
    } else {
      const token = qrcode.token;
      if (hathorLib.tokens.tokenExists(token.uid) === null) {
        // Wallet does not have the selected token
        this.showAlertError(`You don't have the requested token [${getTokenLabel(token)}]`);
        return;
      }
      const address = addressParts[1];
      const amount = qrcode ? qrcode.amount : null;
      this.props.navigation.navigate("SendModal", {address, amount, token});
    }
  }

  render() {
    const getTopContent = () => {
      return (
        <View>
          <Text>Scan the QR code with the transaction info.</Text>
        </View>
      );
    }

    const getBottomContent = () => {
      return (
        <HathorButton
          onPress={() => this.props.navigation.navigate('SendModal')}
          title="Enter info manually"
        />
      )
    }

    return (
        <QRCodeReader
          ref={(el) => this.QRCodeReader = el}
          onSuccess={this.onSuccess}
          topContent={getTopContent()}
          bottomContent={getBottomContent()}
          {...this.props} />
    );
  }
}

export { SendScreen, SendScreenModal };
