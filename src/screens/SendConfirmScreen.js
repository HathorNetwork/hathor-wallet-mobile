import React from 'react';
import { 
  ActivityIndicator,
  Image,
  SafeAreaView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { connect } from 'react-redux';
import Modal from "react-native-modal";

import NewHathorButton from '../components/NewHathorButton';
import SimpleInput from '../components/SimpleInput';
import AmountTextInput from '../components/AmountTextInput';
import InputLabel from '../components/InputLabel';
import { Strong } from '../utils';
import HathorHeader from '../components/HathorHeader';
import { sendTx, sendTxDismiss } from '../actions';
import OfflineBar from '../components/OfflineBar';

import hathorLib from '@hathor/wallet-lib';


/**
 * tokensBalance {Object} dict with balance for each token
 * sendLoading {boolean} indicates send operation is in progress
 * sendError {string} message when there's an error sending tx
 */
const mapStateToProps = (state) => ({
  tokensBalance: state.tokensBalance,
  sendLoading: state.sendTx.loading,
  sendError: state.sendTx.error,
})

const mapDispatchToProps = dispatch => {
  return {
    sendTxDismiss: () => dispatch(sendTxDismiss()),
    sendTx: (amount, address, token, pin, onSuccess) => dispatch(sendTx(amount, address, token, pin, onSuccess)),
  }
}

class SendConfirmScreen extends React.Component {
  /**
   * label {string} label to identify who you're sending this tx (optional)
   * showModal {boolean} whether to display the modal
   */
  state = {
    label: null,
    showModal: false,
  };

  /**
   * amount {int} amount to send
   * address {string} address to send to
   * token {object} info about the selected token to send
   */
  constructor (props) {
    super(props);
    // we receive these 3 values from previous screens
    this.amount = this.props.navigation.getParam('amount');
    this.address = this.props.navigation.getParam('address');
    this.token = this.props.navigation.getParam('token');
  }

  componentWillUnmount() {
    this.props.sendTxDismiss();
  }

  onLabelChange = (text) => {
    this.setState({ label: text });
  }

  executeSend = (pinCode) => {
    this.props.sendTx(this.amount, this.address, this.token, pinCode, this.showConfirmationModal);
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

  showConfirmationModal = () => {
    this.setState({showModal: true});
  }

  exitScreen = () => {
    this.setState({showModal: false});
    this.props.navigation.popToTop();
    this.props.navigation.dismiss();
  }

  render() {
    const getAvailableString = () => {
      // eg: '23.56 HTR available'
      const balance = this.props.tokensBalance[this.token.uid];
      const available = balance ? balance.available : 0;
      return `${hathorLib.helpers.prettyValue(available)} ${this.token.symbol} available`;
    }

    const renderConfirmationModal = () => {
      return (
        <Modal
          isVisible={this.state.showModal}
          animationIn='slideInUp'
          swipeDirection={['down']}
          onSwipeComplete={this.exitScreen}
          onBackButtonPress={this.exitScreen}
          onBackdropPress={this.exitScreen}
          style={styles.modal}
        >
          <View style={styles.innerModal}>
            <Image source={require('../assets/images/icCheckBig.png')} style={{height: 105, width: 105}} resizeMode={"contain"} />
            <Text style={{ fontSize: 18, marginTop: 40, textAlign: 'center' }}>
              Your transfer of 
              <Strong>{` ${hathorLib.helpers.prettyValue(this.amount)} ${this.token.symbol} `}</Strong>
              has been confirmed
            </Text>
          </View>
        </Modal>
      )
    }

    return (
      <SafeAreaView style={{ flex: 1 }}>
        <HathorHeader 
          title={`SEND ${this.token.name.toUpperCase()}`}
          onBackPress={() => this.props.navigation.goBack()}
        />
        {renderConfirmationModal()}
        <View style={{ flex: 1, padding: 16, justifyContent: 'space-between' }}>
          <View>
            <View style={{ alignItems: 'center', marginTop: 32 }}>
              <AmountTextInput
                editable={false}
                value={hathorLib.helpers.prettyValue(this.amount)}
              />
              <InputLabel style={{marginTop: 8}}>
                {getAvailableString()}
              </InputLabel>
            </View>
            <SimpleInput
              label='Address'
              editable={false}
              value={this.address}
              containerStyle={{marginTop: 48}}
            />
            {/* TODO we don't have UI for error and loading yet */}
            <ActivityIndicator size='small' animating={this.props.sendLoading} />
            <Text style={{marginTop: 16, color: "red"}}>{this.props.sendError}</Text>
          </View>
          <NewHathorButton
            title="Send"
            onPress={this.onSendPress}
            disabled={this.props.sendLoading}
          />
        </View>
        <OfflineBar />
      </SafeAreaView>
    );
  }
}

const styles = StyleSheet.create({
  modal: {
    justifyContent: 'flex-end',
  },
  innerModal: {
    backgroundColor: '#fff',
    borderRadius: 8,
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 56,
    paddingTop: 48,
  },
});

export default connect(mapStateToProps, mapDispatchToProps)(SendConfirmScreen);
