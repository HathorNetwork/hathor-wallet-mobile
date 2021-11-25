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
import hathorLib from '@hathor/wallet-lib';
import { connect } from 'react-redux';
import { t } from 'ttag';
import {
  setRecoveringPin,
  lockScreen,
  setTempPin,
  setLoadHistoryStatus,
} from '../actions';
import { guessPin } from '../utils';
import SimpleButton from '../components/SimpleButton';
import Spinner from '../components/Spinner';

const mapStateToProps = (state) => ({
  tempPin: state.tempPin,
});

const mapDispatchToProps = (dispatch) => ({
  setRecoveringPin: (state) => dispatch(setRecoveringPin(state)),
  lockScreen: () => dispatch(lockScreen()),
  setTempPin: () => dispatch(setTempPin(null)),
  setLoadHistoryStatus: (active, error) => dispatch(setLoadHistoryStatus(active, error)),
});

class RecoverPinScreen extends React.Component {
  constructor(props) {
    super(props);

    this.state = {
      erroed: false,
      progress: 0,
    };
  }

  componentDidMount() {
    setTimeout(() => this.recoverPin(), 0);
  }

  goToReset() {
    // navigate to reset screen
    this.props.navigation.navigate('ResetWallet', {
      hideBackButton: true,
    });

    // make sure we won't show loadHistory screen
    this.props.setLoadHistoryStatus(false, false);
  }

  async recoverPin() {
    const accessData = hathorLib.wallet.getWalletAccessData();
    const [success, pin] = await guessPin(accessData, (progress) => {
      this.setState({ progress });
    });

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
    const renderError = () => (
      <View style={{ alignItems: 'center' }}>
        <Text style={{
          fontSize: 18,
          lineHeight: 22,
          width: 200,
          textAlign: 'center'
        }}
        >
          There&apos;s been an error upgrading your wallet.
        </Text>
        <Text style={{
          marginTop: 16,
          fontSize: 18,
          lineHeight: 22,
          width: 200,
          textAlign: 'center'
        }}
        >
          Please reset it and restore it with your seed.
        </Text>
        <SimpleButton
          containerStyle={{ marginTop: 12 }}
          textStyle={{ fontSize: 18 }}
          onPress={() => this.goToReset()}
          title='RESET WALLET'
        />
      </View>
    );

    const renderLoading = (progress) => (
      <View style={{ alignItems: 'center' }} key={`${progress}`}>
        <Spinner size={48} animating />
        <Text
          style={{
            textAlign: 'center',
            marginTop: 8,
          }}
        >
          {progress}%
        </Text>
        <Text style={[styles.text, { marginTop: 32, color: 'rgba(0, 0, 0, 0.5)' }]}>
          {t`Upgrading your wallet, please hang on.`}
        </Text>
      </View>
    );

    return (
      <SafeAreaView style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        {this.state.erroed ? renderError() : renderLoading(this.state.progress)}
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
