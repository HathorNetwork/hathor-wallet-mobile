import React from 'react';
import { Platform, SafeAreaView, StyleSheet, Text, TextInput, View } from 'react-native';
import { connect } from 'react-redux';

import QRCode from 'react-native-qrcode-svg';
import { NavigationEvents } from 'react-navigation';
import { FontAwesomeIcon } from '@fortawesome/react-native-fontawesome'
import { faCheckCircle } from '@fortawesome/free-regular-svg-icons'
import { faChevronDown } from '@fortawesome/free-solid-svg-icons'

import TokenBar from '../components/TokenBar';
import ModalTop from '../components/ModalTop';
import HathorButton from '../components/HathorButton';
import HathorTextInput from '../components/HathorTextInput';
import { clearInvoice, newInvoice } from '../hathorRedux';
import { getNoDecimalsAmount, getAmountParsed, getTokenLabel } from '../utils';

import hathorLib from '@hathor/wallet-lib';


const mapStateToProps = (state) => ({
  selectedToken: state.selectedToken,
  tokens: state.tokens,
})

class _ReceiveScreen extends React.Component {
  constructor(props) {
    super(props);
    this.state = {address: "", amount: "", token: null};

    this.tokenBarElement = React.createRef();
  }

  componentDidMount() {
    this.setState({ token: this.props.selectedToken });
  }

  onGenerateInvoicePress = () => {
    this.props.dispatch(newInvoice(this.state.address, getNoDecimalsAmount(parseFloat(this.state.amount.replace(',', '.'))), this.state.token));
    this.props.navigation.navigate('ReceiveScreenModal');
  }

  onAmountChange = (text) => {
    this.setState({ amount: getAmountParsed(text) });
  }

  onTokenChange = (token) => {
    this.setState({ token });
  }

  render() {
    const renderTokenBarIcon = () => {
      return <FontAwesomeIcon icon={ faChevronDown } color='#ccc' style={{ marginTop: Platform.OS === 'ios' ? -24 : 0 }} />
    }

    return (
      <SafeAreaView style={{ flex: 1, alignItems: "center" }}>
        <NavigationEvents
          //TODO get new address everytime we go to Send screen?
          onWillFocus={payload => this.setState({address: hathorLib.wallet.getAddressToUse()})}
        />
        <Text style={[styles.text16, {marginTop: 24, fontWeight: "bold"}]}>Your address</Text>
        <View style={{ paddingLeft: 16, paddingRight: 16, paddingTop: 8, paddingBottom: 8, marginLeft: 8, marginRight: 8, marginTop: 16, borderRadius: 8, backgroundColor: "#eee", display: "flex", justifyContet: "center", alignItems: "center" }}>
          <Text style={{ fontSize: 14 }} selectable={true}>{this.state.address}</Text>
        </View>
        <HathorButton
          style={{ marginVertical: 16 }}
          onPress={() => this.setState({address: hathorLib.wallet.getAddressToUse()})}
          title="Generate new address"
        />
        <View style={{ display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 32 }}>
          <Text style={[styles.text16, {marginTop: 24, fontWeight: "bold"}]}>Token to receive</Text>
          <TokenBar
            ref={this.tokenBarElement}
            navigation={this.props.navigation}
            onChange={this.onTokenChange}
            tokens={this.props.tokens}
            defaultSelected={this.props.selectedToken.uid}
            icon={renderTokenBarIcon()}
            containerStyle={styles.pickerContainerStyle}
            wrapperStyle={styles.pickerInputContainer}
          />
        </View>
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

const ReceiveScreen = connect(mapStateToProps)(_ReceiveScreen);


const mapInvoiceStateToProps = (state) => ({
  address: state.invoice.address,
  amount: state.invoice.amount,
  token: state.invoice.token,
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
              Payment received at {hathorLib.dateFormatter.parseTimestamp(this.props.payment.timestamp)}
            </Text>
          </View>
        );
      } else {
        return null;
      }
    }

    return (
      <SafeAreaView style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
        <ModalTop title='Payment request' navigation={this.props.navigation} />
        <View style={{flex: 1, justifyContent: "space-around", alignItems: "center"}}>
          <View style={{height: 88}}>
            {getPaymentInfo()}
          </View>
          <QRCode
            value={JSON.stringify({address: `hathor:${this.props.address}`, amount: (this.props.amount || null), token: this.props.token})}
            size={200}
          />
          <View style={{alignItems: "center"}}>
            <Text style={{marginBottom: 8}}>Token</Text>
            <Text style={{marginBottom: 16, fontSize: 24}}>{getTokenLabel(this.props.token)}</Text>
            <Text style={{marginBottom: 8}}>Amount</Text>
            <Text style={{marginBottom: 16, fontSize: 24}}>{this.props.amount ? hathorLib.helpers.prettyValue(this.props.amount) : "not set"}</Text>
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
  pickerContainerStyle: {
    display: 'flex',
    justifyContent: 'flex-start',
    flexDirection: 'row',
    alignItems: 'flex-start',
    height: '100%',
    flex: 1,
  },
  pickerInputContainer: {
    display: 'flex',
    flexDirection: 'row',
    justifyContent: 'flex-start',
    alignItems: 'flex-start',
    width: '100%',
    paddingLeft: 16,
    borderBottomWidth: 1,
    borderColor: '#ccc',
  }
});

const ReceiveScreenModal = connect(mapInvoiceStateToProps)(_ReceiveScreenModal)

export { ReceiveScreen, ReceiveScreenModal };
