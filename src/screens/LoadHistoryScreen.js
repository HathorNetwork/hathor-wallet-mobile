/**
 * Copyright (c) Hathor Labs and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import React from 'react';
import {
  SafeAreaView, StyleSheet, Text, View,
} from 'react-native';
import { connect } from 'react-redux';
import { t } from 'ttag';

import { startWallet, clearInitWallet, resetLoadedData } from '../actions';
import {
  setSupportedBiometry, getSupportedBiometry, setBiometryEnabled, isBiometryEnabled,
} from '../utils';
import SimpleButton from '../components/SimpleButton';
import Spinner from '../components/Spinner';
import TextFmt from '../components/TextFmt';


/**
 * loadHistoryStatus {Object} progress on loading tx history {
 *   active {boolean} indicates we're loading the tx history
 *   error {boolean} error loading history
 * }
 * initWallet {Object} Information on wallet initialization (if not needed, set to null)
 *   words {str} wallet words
 *   pin {str} pin selected by user
 * }
 */
const mapStateToProps = (state) => ({
  loadHistoryStatus: state.loadHistoryStatus,
  initWallet: state.initWallet,
  loadedData: state.loadedData,
});

const mapDispatchToProps = (dispatch) => ({
  startWallet: (words, pin) => dispatch(startWallet(words, pin)),
  clearInitWallet: () => dispatch(clearInitWallet()),
  resetLoadedData: () => dispatch(resetLoadedData()),
});

class LoadHistoryScreen extends React.Component {
  componentDidMount() {
    // This setTimeout exists to prevent blocking the main thread
    setTimeout(() => this.initializeWallet(), 0);
    this.props.resetLoadedData();
  }

  componentWillUnmount() {
    this.props.clearInitWallet();
  }

  initializeWallet() {
    if (this.props.initWallet) {
      const { words, pin } = this.props.initWallet;

      this.props.startWallet(words, pin);
    }
  }

  render() {
    const renderError = () => (
      <View style={{ alignItems: 'center' }}>
        <Text style={{
          fontSize: 18, lineHeight: 22, width: 200, textAlign: 'center'
        }}
        >
          There&apos;s been an error connecting to the server
        </Text>
        <SimpleButton
          containerStyle={{ marginTop: 12 }}
          textStyle={{ fontSize: 18 }}
          onPress={this.props.loadHistory}
          title='Try again'
        />
      </View>
    );

    const renderLoading = () => (
      <View style={{ alignItems: 'center' }}>
        <Spinner size={48} animating />
        <Text style={[styles.text, { marginTop: 32, color: 'rgba(0, 0, 0, 0.5)' }]}>
          {t`Loading your transactions`}
        </Text>
        <TextFmt style={[styles.text, { marginTop: 24 }]}>
          {t`**${this.props.loadedData.transactions} transactions** found`}
        </TextFmt>
        <TextFmt style={styles.text}>
          {t`**${this.props.loadedData.addresses} addresses** found`}
        </TextFmt>
      </View>
    );

    return (
      <SafeAreaView style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        {this.props.loadHistoryStatus.error ? renderError() : renderLoading()}
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

export default connect(mapStateToProps, mapDispatchToProps)(LoadHistoryScreen);
