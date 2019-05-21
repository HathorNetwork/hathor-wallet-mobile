import React from 'react';
import { Button, FlatList, SafeAreaView, Text, View } from 'react-native';
import { connect } from 'react-redux';

import { clearNetworkError, historyUpdate, networkError, newTx } from '../hathorRedux';
import { getShortHash } from '../utils';


const mapStateToProps = (state) => ({
  txList: state.txList,
  balance: state.balance,
  networkError: state.networkError,
})

class MainScreen extends React.Component {
  constructor(props) {
    super(props);
    this.state = {isLoading: true};
  }

  componentDidMount() {
    const words = this.props.navigation.getParam('words');
    global.hathorLib.wallet.executeGenerateWallet(words, '', '123456', '123456', false);
    global.hathorLib.WebSocketHandler.on('wallet', this.handleWebsocketMsg);
    global.hathorLib.WebSocketHandler.on('reload_data', this.fetchDataFromServer);
    global.hathorLib.WebSocketHandler.on('is_online', this.handleWebsocketStateChange);
    this.fetchDataFromServer();
  }

  fetchDataFromServer = () => {
    this.setState({isLoading: true});
    global.hathorLib.version.checkApiVersion().then(data => {
      global.hathorLib.wallet.reloadData().then(() => {
        const data = global.hathorLib.wallet.getWalletData();
        // Update historyTransactions with new one
        const historyTransactions = 'historyTransactions' in data ? data['historyTransactions'] : {};
        const keys = global.hathorLib.wallet.getWalletData().keys;
        this.props.dispatch(historyUpdate(historyTransactions, keys));
        this.setState({isLoading: false});
      }, error => {
        this.setState({isLoading: false});
      })
    }, error => {
      this.setState({isLoading: false});
    });
  }

  handleWebsocketStateChange = isOnline => {
    console.log('isOnline', isOnline);
    if (isOnline) {
      this.props.dispatch(clearNetworkError());
    } else {
      const timestamp = Date.now();
      this.props.dispatch(networkError(timestamp));
    }
  }

  handleWebsocketMsg = wsData => {
    console.log('ws', wsData);
    if (wsData.type === "wallet:address_history") {
      //TODO we also have to update some wallet lib data? Lib should do it by itself
      const walletData = hathorLib.wallet.getWalletData();
      const historyTransactions = 'historyTransactions' in walletData ? walletData['historyTransactions'] : {};
      const allTokens = 'allTokens' in walletData ? walletData['allTokens'] : [];
      global.hathorLib.wallet.updateHistoryData(historyTransactions, allTokens, [wsData.history], null, walletData)


      const keys = global.hathorLib.wallet.getWalletData().keys;
      this.props.dispatch(newTx(wsData.history, keys));
    }
  }

  render() {
    if (!this.props.txList && this.state.isLoading) {
      return (
        <SafeAreaView style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
          <Text>Loading</Text>
          <Text>Loading</Text>
          <Text>Loading</Text>
          <Text>Loading</Text>
          <Text>Loading</Text>
        </SafeAreaView>
      );
    } else if (this.props.networkError && !this.props.txList) {
      return (
        <SafeAreaView style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
          <Text>NetworkError</Text>
        </SafeAreaView>
      );
    } else {
      return (
        <SafeAreaView style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
          <Text>Main Screen</Text>
          <Text>Balance: {global.hathorLib.helpers.prettyValue(this.props.balance)}</Text>
          <FlatList
            data={this.props.txList}
            renderItem={({item}) => <Text>{`${getShortHash(item.tx_id)} - ${global.hathorLib.dateFormatter.parseTimestamp(item.timestamp)} - ${global.hathorLib.helpers.prettyValue(item.balance)}`}</Text>}
            keyExtractor={(item, index) => item.tx_id}
          />
        </SafeAreaView>
      );
    }
  }
}

export default connect(mapStateToProps)(MainScreen)
