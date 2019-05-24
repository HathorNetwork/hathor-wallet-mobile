import React from 'react';
import { ActivityIndicator, Alert, AppState, SafeAreaView, Text, TouchableOpacity, View } from 'react-native';

import QRCodeScanner from 'react-native-qrcode-scanner';
import { NavigationEvents } from 'react-navigation';
import { FontAwesomeIcon } from '@fortawesome/react-native-fontawesome'
import { faTimes } from '@fortawesome/free-solid-svg-icons'

import HathorButton from '../components/HathorButton';
import HathorTextInput from '../components/HathorTextInput';
import { getDecimalsAmount, getNoDecimalsAmount, getAmountParsed } from '../utils';


class SendScreenModal extends React.Component {
  constructor(props) {
    super(props);
    const address = this.props.navigation.getParam("address", null);
    let amount = this.props.navigation.getParam("amount", null);
    if (amount) {
      amount = getDecimalsAmount(amount).toString();
    }
    this.state = {address, amount, error: null, spinner: false};
  }

  sendTx = () => {
    this.setState({error: null, spinner: true});
    const value = getNoDecimalsAmount(parseFloat(this.state.amount.replace(',', '.')));
    const data = {};
    data.tokens = [];
    data.inputs = [];
    data.outputs = [{address: this.state.address, value: value, timelock: null, tokenData: 0}];
    const walletData = global.hathorLib.wallet.getWalletData();
    const historyTransactions = 'historyTransactions' in walletData ? walletData['historyTransactions'] : {};
    const ret = global.hathorLib.wallet.prepareSendTokensData(data, global.hathorLib.constants.HATHOR_TOKEN_CONFIG, true, historyTransactions, []);
    if (ret.success) {
      try {
        global.hathorLib.transaction.sendTransaction(ret.data, '123456').then(() => {
          this.props.navigation.goBack();
          this.setState({spinner: false});
        }, (error) => {
          this.setState({spinner: false, error: 'Error connecting to the network'});
        });
      } catch (e) {
        if (e instanceof global.hathorLib.errors.AddressError || e instanceof global.hathorLib.errors.OutputValueError) {
          this.setState({spinner: false, error: e.message});
        }
      }
    } else {
      this.setState({spinner: false, error: ret.message});
    }
  }

  onAmountChange = text => {
    this.setState({ amount: getAmountParsed(text) });
  }

  render() {
    return (
      <SafeAreaView style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
        <View style={{flexDirection: "row", justifyContent: "space-between", marginBottom: 24, marginTop: 16}}>
          <View style={{flex: 1}}></View>
          <Text style={{flex: 3, textAlign: "center", fontSize: 24}}>Send tokens</Text>
          <View style={{justifyContent: "center", alignItems: "flex-end", paddingHorizontal: 16}}>
            <TouchableOpacity style={{paddingHorizontal: 4}} onPress={() => this.props.navigation.goBack()}>
              <FontAwesomeIcon icon={ faTimes } size={24} />
            </TouchableOpacity>
          </View>
        </View>
        <View style={{flex: 1, marginTop: 32, alignItems: "center"}}>
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
            title="Send"
            disabled={!(this.state.address && this.state.amount) || this.state.spinner}
          />
          <Text style={{marginTop: 16, color: "red"}}>{this.state.error}</Text>
          <ActivityIndicator size="small" animating={this.state.spinner} />
        </View>
      </SafeAreaView>
    )
  }
}


class SendScreen extends React.Component {
  constructor(props) {
    super(props);

    this.qrCodeScanner = null;

    this.state = {
      focusedScreen: false,
      appState: AppState.currentState,
    };
  }

  componentDidMount() {
    // We need to focus/unfocus the qrcode scanner, so it does not freezes
    // When the navigation focus on this screen, we set to true
    // When the navigation stops focusing on this screen, we set to false
    // When the app stops being in the active state, we set to false
    // When the app starts being in the active state, we set to true
    const { navigation } = this.props;
    navigation.addListener('willFocus', () => {
      console.log('focused treue');
      this.setState({ focusedScreen: true });
    });
    navigation.addListener('willBlur', () => {
      console.log('focused false');
      this.setState({ focusedScreen: false });
    });
    AppState.addEventListener('change', this._handleAppStateChange);
  }

  _handleAppStateChange = (nextAppState) => {
    if (this.state.appState === 'active' && nextAppState !== 'active') {
      // It's changing and wont be active anymore
      this.setState({ focusedScreen: false });
    } else if (nextAppState === 'active' && this.state.appState !== 'active') {
      this.setState({ focusedScreen: true });
    }

    this.setState({ appState: nextAppState });
  }

  onSuccess = (e) => {
    let hathorAddress;
    let qrcode;
    try {
      qrcode = JSON.parse(e.data);
      hathorAddress = qrcode.address;
    } catch (error) {
      // if it's not json, maybe it's just the address from wallet ("hathor:{address}")
      hathorAddress = e.data;
    }
    const addressParts = hathorAddress.split(":");
    if (addressParts[0] !== "hathor" || addressParts.length !== 2) {
      Alert.alert(
        "Invalid QR code",
        "This QR code does not contain a Hathor address or payment request.",
        [
          {text: "OK", onPress: this.reactivateQrCodeScanner},
        ],
        {cancelable: false},
      );
    } else {
      const address = addressParts[1];
      const amount = qrcode ? qrcode.amount : null;
      this.props.navigation.navigate("SendModal", {address, amount});
    }
  }

  reactivateQrCodeScanner = () => {
    this.qrCodeScanner && this.qrCodeScanner.reactivate();
  }

  render() {
    if (!this.state.focusedScreen) return null;

    return (
        <QRCodeScanner
          ref={(node) => { this.qrCodeScanner = node }}
          onRead={this.onSuccess}
          showMarker={true}
          topContent={
            <View>
              <NavigationEvents
                onWillFocus={payload => this.qrCodeScanner && this.qrCodeScanner.reactivate()}
              />
              <Text>Scan the QR code with the transaction info.</Text>
            </View>
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
