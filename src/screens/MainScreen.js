import React from 'react';
import { Button, FlatList, SafeAreaView, Text, View } from 'react-native';
import { connect } from 'react-redux';

import { historyUpdate, newTx } from '../hathorRedux';
import { getShortHash } from '../utils';


const mapStateToProps = (state) => ({
  txList: state.txList,
  balance: state.balance,
})

class MainScreen extends React.Component {
  constructor(props) {
    super(props);
  }

  componentDidMount() {
    const words = this.props.navigation.getParam('words');
    const promise = global.hathorLib.wallet.executeGenerateWallet(words, '', '123456', '123456', true);
    promise.then(() => {
      global.hathorLib.WebSocketHandler.on('wallet', this.handleWebsocketMsg);
      const data = global.hathorLib.wallet.getWalletData();
      // Update historyTransactions with new one
      const historyTransactions = 'historyTransactions' in data ? data['historyTransactions'] : {};
      const keys = global.hathorLib.wallet.getWalletData().keys;
      this.props.dispatch(historyUpdate(historyTransactions, keys));
    });

    // TODO not handling promise
    global.hathorLib.version.checkApiVersion();
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

export default connect(mapStateToProps)(MainScreen)
