/**
 * Copyright (c) Hathor Labs and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import React from 'react';
import {
  SafeAreaView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { connect } from 'react-redux';
import { t } from 'ttag';
import {
  startWallet,
  clearInitWallet,
  resetLoadedData,
  setRecoveringPin,
  lockScreen,
  setTempPin,
} from '../actions';
import Spinner from '../components/Spinner';
import hathorLib from '@hathor/wallet-lib';


const mapStateToProps = (state) => ({
  tempPin: state.tempPin,
});

const mapDispatchToProps = (dispatch) => ({
  setRecoveringPin: (state) => dispatch(setRecoveringPin(state)),
  lockScreen: () => dispatch(lockScreen()),
  setTempPin: () => dispatch(setTempPin(null)),
});

class RecoverPinScreen extends React.Component {
  componentDidMount() {
    setTimeout(() => this.recoverPin(), 0)
  }

  recoverPin() {
    const [success, pin] = hathorLib.wallet.guessPin();

    if (!success) {
      this.setState({
        erroed: true,
      });
      return;
    }

    const currentPin = this.props.tempPin;
    // update the encrypted words with the pin the user knows about
    hathorLib.wallet.changePassword(pin, currentPin);

    this.props.setRecoveringPin(false);
    this.props.lockScreen();
  }

  render() {
    const renderLoading = () => (
      <View style={{ alignItems: 'center' }}>
        <Spinner size={48} animating />
        <Text style={[styles.text, { marginTop: 32, color: 'rgba(0, 0, 0, 0.5)' }]}>
          {t`Upgrading your wallet, please hang on.`}
        </Text>
      </View>
    );

    return (
      <SafeAreaView style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        {renderLoading()}
      </SafeAreaView>
    );
  }
}

const styles = StyleSheet.create({
  text: {
    fontSize: 16,
    lineHeight: 20,
    textAlign: 'center',
    marginTop: 16,
  },
});

export default connect(mapStateToProps, mapDispatchToProps)(RecoverPinScreen);
