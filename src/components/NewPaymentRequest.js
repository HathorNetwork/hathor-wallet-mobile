import React from 'react';
import { Dimensions, KeyboardAvoidingView, Platform, StyleSheet, TouchableWithoutFeedback, View, Text } from 'react-native';
import { getStatusBarHeight } from 'react-native-status-bar-height';
import NewHathorButton from './NewHathorButton';
import AmountTextInput from './AmountTextInput';
import TokenBox from './TokenBox';
import { newInvoice } from '../actions';
import { getNoDecimalsAmount } from '../utils';

import { connect } from 'react-redux';

import { FontAwesomeIcon } from '@fortawesome/react-native-fontawesome'
import { faSortDown } from '@fortawesome/free-solid-svg-icons'


/**
 * selectedToken {Object} Select token config {name, symbol, uid}
 */
const mapStateToProps = (state) => ({
  selectedToken: state.selectedToken,
})


class NewPaymentRequest extends React.Component {
  constructor(props) {
    super(props);

    /**
     * amount {string} Amount for the payment request
     * token {Object} Selected token config
     */
    this.state = {
      amount: "",
      token: this.props.selectedToken,
    };

    // If the payment request detail modal was opened
    this.modalOpened = false
    this.willFocusEvent = null;
    this.inputRef = React.createRef();
  }

  componentDidMount() {
    const { navigation } = this.props;
    this.willFocusEvent = navigation.addListener('willFocus', () => {
      if (this.modalOpened) {
        // It's coming back
        this.modalOpened = false;
        this.focusInput();
      }
    });
  }

  focus = () => {
    this.setState({ amount: "", token: this.props.selectedToken });
    this.focusInput();
  }

  focusInput = () => {
    if (this.inputRef.current) {
      this.inputRef.current.focus();
    }
  }

  onTokenChange = (token) => {
    this.setState({ token });
  }

  componentWillUnmount() {
    this.willFocusEvent.remove();
  }

  createPaymentRequest = () => {
    this.props.dispatch(newInvoice(this.props.address, getNoDecimalsAmount(parseFloat(this.state.amount.replace(',', '.'))), this.state.token));
    this.modalOpened = true;
    this.props.navigation.navigate('PaymentRequestDetail');
  }

  isButtonDisabled = () => {
    if (this.state.amount === "") {
      return true;
    }

    if (getNoDecimalsAmount(parseFloat(this.state.amount.replace(',', '.'))) === 0) {
      return true;
    }

    return false;
  }

  onTokenBoxPress = () => {
    this.modalOpened = true;
    this.props.navigation.navigate(
      'ChangeToken',
      {
        token: this.state.token,
        onItemPress: (item) => {
          this.onTokenChange(item);
        }
      }
    );
  }

  render() {
    // Status bar + header + tab height
    const topDistance = getStatusBarHeight() + 56 + 48;

    const { height, _ } = Dimensions.get('window');

    // For small devices the button was hidden
    const inputMargin = height > 650 ? 64 : 32;

    const buttonWrapperStyle = StyleSheet.create({
      style: {
        marginHorizontal: 16,
        marginBottom: 16,
        marginTop: inputMargin,
        flex: 1,
        justifyContent: 'flex-end',
        alignSelf: 'stretch',
      }
    });

    return (
      <KeyboardAvoidingView behavior='padding' style={{ flex: 1 }} keyboardVerticalOffset={topDistance}>
        <View style={{ flex: 1, alignItems: "center", justifyContent: "space-between", width: "100%", marginBottom: 16 }}>
          <View style={{ alignSelf: 'stretch', flexDirection: "row", alignItems: "center", justifyContent: "space-between", padding: 16, marginTop: inputMargin }}>
            <View style={{ width: 80, height: 40 }}></View>
            <AmountTextInput
              ref={this.inputRef}
              onAmountUpdate={(amount) => this.setState({ amount })}
              value={this.state.amount}
              style={{flex: 1}}
            />
            <TokenBox
              onPress={this.onTokenBoxPress}
              label={this.state.token.symbol}
            />
          </View>
          <View style={buttonWrapperStyle.style}>
            <NewHathorButton
              disabled={this.isButtonDisabled()}
              title="Create payment request"
              onPress={this.createPaymentRequest}
             />
          </View>
        </View>
      </KeyboardAvoidingView>
    )
  }
}

const styles = StyleSheet.create({
  pickerContainerStyle: {
    justifyContent: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    alignSelf: 'stretch',
  },
  pickerInputContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    alignSelf: 'stretch',
    flex: 1,
    paddingLeft: 8,
  },
});


export default connect(mapStateToProps, null, null, { forwardRef: true })(NewPaymentRequest);