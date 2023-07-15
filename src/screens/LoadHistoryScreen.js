/**
 * Copyright (c) Hathor Labs and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import React from 'react';
import {
  StyleSheet, Text, View,
} from 'react-native';
import { connect } from 'react-redux';
import { t } from 'ttag';

import {
  onWalletReload,
  resetLoadedData,
} from '../actions';
import SimpleButton from '../components/SimpleButton';
import Spinner from '../components/Spinner';
import TextFmt from '../components/TextFmt';

/**
 * loadHistoryStatus {Object} progress on loading tx history {
 *   active {boolean} indicates we're loading the tx history
 *   error {boolean} error loading history
 * }
 */
const mapStateToProps = (state) => ({
  loadHistoryStatus: state.loadHistoryStatus,
  loadedData: state.loadedData,
});

const mapDispatchToProps = (dispatch) => ({
  reloadHistory: () => dispatch(onWalletReload()),
  resetLoadedData: () => dispatch(resetLoadedData()),
});

class LoadHistoryScreen extends React.Component {
  componentDidMount() {
    this.props.resetLoadedData();
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
          onPress={() => this.props.reloadHistory()}
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
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        {this.props.loadHistoryStatus.error ? renderError() : renderLoading()}
      </View>
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
