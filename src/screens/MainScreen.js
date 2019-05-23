import React from 'react';
import { ActivityIndicator, FlatList, SafeAreaView, StyleSheet, Text, View } from 'react-native';
import { connect } from 'react-redux';

import HathorButton from '../components/HathorButton';
import { balanceUpdate, clearNetworkError, historyUpdate, networkError, newTx, resetData } from '../hathorRedux';
import { getShortHash } from '../utils';


const mapStateToProps = (state) => ({
  txList: state.txList,
  balance: state.balance,
  networkError: state.networkError,
})

class MainScreen extends React.Component {
  state = { isLoading: true };

  componentDidMount() {
    const words = this.props.navigation.getParam('words', null);
    if (words) {
      global.hathorLib.wallet.executeGenerateWallet(words, '', '123456', '123456', false);
    }
    global.hathorLib.WebSocketHandler.on('wallet', this.handleWebsocketMsg);
    global.hathorLib.WebSocketHandler.on('reload_data', this.fetchDataFromServer);
    global.hathorLib.WebSocketHandler.on('is_online', this.handleWebsocketStateChange);
    this.fetchDataFromServer();
  }

  componentWillUnmount() {
    console.log("MainScreen willUnmount");
    global.hathorLib.WebSocketHandler.removeListener('wallet', this.handleWebsocketMsg);
    global.hathorLib.WebSocketHandler.removeListener('reload_data', this.fetchDataFromServer);
    global.hathorLib.WebSocketHandler.removeListener('is_online', this.handleWebsocketStateChange);
    this.props.dispatch(resetData());
  }

  fetchDataFromServer = () => {
    this.cleanData();
    this.setState({isLoading: true});
    global.hathorLib.version.checkApiVersion().then(data => {
      const accessDataStorage = global.localStorage.getItem('wallet:accessData');
      const walletData = global.hathorLib.wallet.getWalletData();
      global.hathorLib.wallet.loadAddressHistory(0, global.hathorLib.constants.GAP_LIMIT).then(() => {
        this.props.dispatch(clearNetworkError());
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

  cleanData = () => {
    // Get old access data
    const accessDataStorage = global.localStorage.getItem('wallet:accessData');
    const walletData = global.hathorLib.wallet.getWalletData();
    const server = global.localStorage.getItem('wallet:server');

    global.localStorage.clear();

    let accessData = global.localStorage.memory ? accessDataStorage : JSON.parse(accessDataStorage);
    let newWalletData = {
      keys: {},
      xpubkey: walletData.xpubkey,
    }
    // Prepare to save new data
    accessData = global.localStorage.memory ? accessData : JSON.stringify(accessData);
    newWalletData = global.localStorage.memory ? newWalletData : JSON.stringify(newWalletData);

    global.localStorage.setItem('wallet:accessData', accessData);
    global.localStorage.setItem('wallet:data', newWalletData);
    global.localStorage.setItem('wallet:server', server);
  }

  handleWebsocketStateChange = isOnline => {
    if (isOnline === undefined) {
      return;
    }
    console.log('ws online', isOnline)
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
    } else if (wsData.type === "wallet:balance_updated") {
      this.props.dispatch(balanceUpdate(wsData.balance));
    }
  }

  render() {
    const colors = ['#eee', 'white'];

    const getValueColor = (value) => {
      if (value > 0) return '#28a745';
      else if (value < 0) return '#dc3545';
      else return 'black';
    }

    const renderItem = ({item, index}) => {
      return (
        <View style={[mainStyle.listItemWrapper, { backgroundColor: colors[index % 2] }]}>
          <Text style={[mainStyle.dateColumn, mainStyle.listColumn]}>{global.hathorLib.dateFormatter.parseTimestamp(item.timestamp)}</Text>
          <Text style={[mainStyle.idColumn, mainStyle.listColumn]}>{getShortHash(item.tx_id)}</Text>
          <Text style={[mainStyle.valueColumn, {color: getValueColor(item.balance), textAlign: 'left' }]}>{global.hathorLib.helpers.prettyValue(item.balance)}</Text>
        </View>
      )
    }

    const renderListHeader = ({item}) => {
      if (this.state.isLoading) return null;

      return (
        <View style={[mainStyle.listItemWrapper, { backgroundColor: 'white' }]}>
          <Text style={[mainStyle.dateColumn, mainStyle.listColumn]}>Date</Text>
          <Text style={[mainStyle.idColumn, mainStyle.listColumn]}>ID</Text>
          <Text style={[mainStyle.valueColumn, mainStyle.listColumn]}>Value</Text>
        </View>
      );
    }

    const renderTxHistory = () => {
      if (this.props.txList && (this.props.txList.length > 0)) {
        return (
          <View style={{ flex: 1, alignSelf: "stretch" }}>
            <Text style={{ fontWeight: "bold", textAlign: "center", fontSize: 20, margin: 16 }}>Transaction history</Text>
            <FlatList
              data={this.props.txList}
              renderItem={renderItem}
              keyExtractor={(item, index) => item.tx_id}
              ListHeaderComponent={renderListHeader}
              stickyHeaderIndices={[0]}
            />
          </View>
        );
      } else if (!this.state.isLoading && !this.props.networkError) {
        //empty history
        return <Text style={{ fontSize: 16, textAlign: "center" }}>You don't have any transactions</Text>;
      } else if (!this.state.isLoading && this.props.networkError) {
        return (
          <View>
            <Text style={{ fontSize: 16, textAlign: "center" }}>There's been an error connecting to the server</Text>
            <HathorButton
              style={{marginTop: 24}}
              onPress={this.fetchDataFromServer}
              title="Try again"
            />
          </View>
        );
      }
    }

    return (
      <SafeAreaView style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
        <View style={{ display: "flex", flexDirection: "row", width: "100%", alignItems: "center", height: 120, backgroundColor: "#0273a0", padding: 24 }}>
          <Text style={mainStyle.topTextTitle}>Hathor</Text>
          <View style={{ display: "flex", alignItems: "flex-start", marginLeft: 24 }}>
            <Text style={mainStyle.topText}>Total: {global.hathorLib.helpers.prettyValue(this.props.balance.available + this.props.balance.locked)} HTR</Text>
            <Text style={mainStyle.topText}>Available: {global.hathorLib.helpers.prettyValue(this.props.balance.available)} HTR</Text>
            <Text style={mainStyle.topText}>Locked: {global.hathorLib.helpers.prettyValue(this.props.balance.locked)} HTR</Text>
          </View>
        </View>
        <View style={{ flex: 1, justifyContent: "center", alignSelf: "stretch" }}>
          {this.state.isLoading && <ActivityIndicator style={{marginVertical: 24}} size="large" animating={true} />}
          {renderTxHistory()}
        </View>
      </SafeAreaView>
    );
  }
}

const mainStyle = StyleSheet.create({
  topText: {
    color: "white",
    lineHeight: 20,
  },
  topTextTitle: {
    color: "white",
    fontWeight: "bold",
    fontSize: 28,
  },
  listItemWrapper: {
    display: 'flex',
    flex: 1,
    alignSelf: 'stretch',
    justifyContent: 'space-around',
    flexDirection: 'row',
    paddingBottom: 8,
    paddingTop: 8
  },
  dateColumn: {
    width: 170,
  },
  idColumn: {
    width: 100,
  },
  valueColumn: {
    flex: 0,
  },
  listColumn: {
    textAlign: 'center',
  }
});

export default connect(mapStateToProps)(MainScreen)
