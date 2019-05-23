import React from 'react';
import { SafeAreaView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { connect } from 'react-redux';

import QRCode from 'react-native-qrcode-svg';
import { NavigationEvents } from 'react-navigation';
import { FontAwesomeIcon } from '@fortawesome/react-native-fontawesome'
import { faCheckCircle } from '@fortawesome/free-regular-svg-icons'
import { faTimes } from '@fortawesome/free-solid-svg-icons'

import HathorButton from '../components/HathorButton';
import HathorTextInput from '../components/HathorTextInput';
import { clearInvoice, newInvoice } from '../hathorRedux';
import { getNoDecimalsAmount, getAmountParsed } from '../utils';


class _ReceiveScreen extends React.Component {
  constructor(props) {
    super(props);
    this.state = {address: "", amount: ""};
  }

  onGenerateInvoicePress = () => {
    this.props.dispatch(newInvoice(this.state.address, getNoDecimalsAmount(parseFloat(this.state.amount.replace(',', '.')))));
    this.props.navigation.navigate('ReceiveScreenModal');
  }

  onAmountChange = (text) => {
    this.setState({ amount: getAmountParsed(text) });
  }

  render() {
    return (
      <SafeAreaView style={{ flex: 1, alignItems: "center" }}>
        <NavigationEvents
          //TODO get new address everytime we go to Send screen?
          onWillFocus={payload => this.setState({address: global.hathorLib.wallet.getAddressToUse()})}
        />
        <Text style={[styles.text16, {marginTop: 24, fontWeight: "bold"}]}>Your address</Text>
        <View style={{ paddingLeft: 16, paddingRight: 16}}>
          <Text style={[styles.text16, {marginTop: 16}]} selectable={true}>{this.state.address}</Text>
        </View>
        <HathorButton
          style={{marginBottom: 48, marginTop: 16}}
          onPress={() => this.setState({address: global.hathorLib.wallet.getAddressToUse()})}
          title="Generate new address"
        />
        <Text style={styles.text16}>Amount</Text>
        <Text style={styles.text16}>(optional)</Text>
        <HathorTextInput
          style={{fontSize: 24, width: 120, padding: 12, marginTop: 16}}
          onChangeText={this.onAmountChange}
          value={this.state.amount}
          placeholder="0.00"
          keyboardType="numeric"
          returnKeyType="done"
        />
        <HathorButton
          style={{marginTop: 48, fontSize: 14}}
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
    this.props.dispatch(clearInvoice());
  }

  render() {
    const getPaymentInfo = () => {
      if (this.props.payment) {
        return (
          <View style={{flex: 1, justifyContent: "space-around", alignItems: "center"}}>
            <FontAwesomeIcon icon={ faCheckCircle } size={32} color={"green"} />
            <Text style={[styles.font16, {color: "green"}]}>
              Payment received at {global.hathorLib.dateFormatter.parseTimestamp(this.props.payment.timestamp)}
            </Text>
          </View>
        );
      } else {
        return null;
      }
    }

    return (
      <SafeAreaView style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
        <View style={{flexDirection: "row", justifyContent: "space-between", marginBottom: 24}}>
          <View style={{flex: 1}}></View>
          <Text style={{flex: 3, textAlign: "center", fontSize: 24}}>Payment request</Text>
          <View style={{justifyContent: "center", alignItems: "flex-end", paddingHorizontal: 16}}>
            <TouchableOpacity style={{paddingHorizontal: 4}} onPress={() => this.props.navigation.goBack()}>
              <FontAwesomeIcon icon={ faTimes } size={24} />
            </TouchableOpacity>
          </View>
        </View>
        <View style={{flex: 1, justifyContent: "space-around", alignItems: "center"}}>
          <View style={{height: 88}}>
            {getPaymentInfo()}
          </View>
          <QRCode
            value={JSON.stringify({address: `hathor:${this.props.address}`, amount: (this.props.amount || null)})}
            size={200}
          />
          <View style={{alignItems: "center"}}>
            <Text style={{marginBottom: 8}}>Amount</Text>
            <Text style={{marginBottom: 16, fontSize: 24}}>{this.props.amount ? global.hathorLib.helpers.prettyValue(this.props.amount) : "not set"}</Text>
            <Text style={{marginBottom: 8}}>Address</Text>
            <Text style={{marginBottom: 16}} selectable={true}>{this.props.address}</Text>
          </View>
        </View>
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
