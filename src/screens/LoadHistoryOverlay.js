import React from "react";
import { ActivityIndicator, SafeAreaView, StyleSheet, Text, View } from "react-native";
import { connect } from 'react-redux';

import { updateLoadHistoryStatus } from '../actions';
import SimpleButton from '../components/SimpleButton';
import hathorLib from '@hathor/wallet-lib';


/**
 * historyLoading {boolean} indicates we're fetching history from server (display spinner)
 * loadHistoryStatus {Object} progress on loading tx history ({transactions, addresses, error})
 */
const mapStateToProps = (state) => ({
  historyLoading: state.historyLoading,
  loadHistoryStatus: state.loadHistoryStatus,
})

const mapDispatchToProps = dispatch => {
  return {
    resetLoadHistoryStatus: () => dispatch(updateLoadHistoryStatus(0, 0)),
  }
}

class LoadHistoryOverlay extends React.Component {
  componentDidUpdate(prevProps) {
    if (this.props.loadHistoryStatus.error) return;
    if (prevProps.historyLoading && !this.props.historyLoading) {
      this.props.navigation.goBack();
    }
  }

  componentWillUnmount() {
    this.props.resetLoadHistoryStatus();
  }

  render() {
    const renderError = () => (
      <View style={{alignItems: 'center'}}>
        <Text style={styles.text}>There's been an error connecting to the server</Text>
        <SimpleButton
          containerStyle={{marginTop: 24}}
          onPress={this.props.navigation.getParam('retryMethod')}
          title="Try again"
        />
      </View>
    )

    const renderLoading = () => (
      <View style={{alignItems: 'center'}}>
        <ActivityIndicator size='large' animating={true} />
        <Text style={styles.text}>Loading your transactions</Text>
        <Text style={styles.text}>{this.props.loadHistoryStatus.transactions} transactions found</Text>
        <Text style={styles.text}>{this.props.loadHistoryStatus.addresses} addresses found</Text>
      </View>
    )

    return (
      <SafeAreaView style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        {this.props.loadHistoryStatus.error && renderError()}
        {this.props.historyLoading && renderLoading()}
      </SafeAreaView>
    )
  }
}

const styles = StyleSheet.create({
  text: {
    fontSize: 16,
    textAlign: 'center',
    marginTop: 16,
  }
});

export default connect(mapStateToProps, mapDispatchToProps)(LoadHistoryOverlay);
