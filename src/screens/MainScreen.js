import React from 'react';
import { ActivityIndicator, FlatList, SafeAreaView, StyleSheet, Text, View } from 'react-native';
import { connect } from 'react-redux';

import HathorButton from '../components/HathorButton';
import TokenBar from '../components/TokenBar';
import { FontAwesomeIcon } from '@fortawesome/react-native-fontawesome';
import { faExchangeAlt } from '@fortawesome/free-solid-svg-icons';
import { balanceUpdate, clearNetworkError, historyUpdate, networkError, newTx, resetData, setTokens, updateSelectedToken } from '../hathorRedux';
import { getShortHash } from '../utils';


/**
 * txList {Object} array with transactions of the selected token
 * balance {Object} object with token balance {'available', 'locked'}
 * networkError {number} timestamp when the network error happened (null if no error)
 * selectedToken {string} uid of the selected token
 * tokens {Object} array with all added tokens on this wallet
 */
const mapStateToProps = (state) => ({
  txList: state.txList,
  balance: state.balance,
  networkError: state.networkError,
  selectedToken: state.selectedToken,
  tokens: state.tokens
})

class MainScreen extends React.Component {
  /**
   * isLoading {boolean} if should show list of spinner
   */
  state = { isLoading: true };

  componentDidMount() {
    const words = this.props.navigation.getParam('words', null);
    if (words) {
      global.hathorLib.wallet.executeGenerateWallet(words, '', '123456', '123456', false);
    }
    global.hathorLib.WebSocketHandler.on('wallet', this.handleWebsocketMsg);
    global.hathorLib.WebSocketHandler.on('reload_data', this.fetchDataFromServer);
    global.hathorLib.WebSocketHandler.on('is_online', this.handleWebsocketStateChange);
    // We need to update the redux tokens with data from localStorage, so the user dont have to add the tokens again
    this.updateReduxTokens();
    this.fetchDataFromServer();
  }

  componentWillUnmount() {
    global.hathorLib.WebSocketHandler.removeListener('wallet', this.handleWebsocketMsg);
    global.hathorLib.WebSocketHandler.removeListener('reload_data', this.fetchDataFromServer);
    global.hathorLib.WebSocketHandler.removeListener('is_online', this.handleWebsocketStateChange);
    this.props.dispatch(resetData());
  }

  updateReduxTokens = () => {
    this.props.dispatch(setTokens(global.hathorLib.tokens.getTokens()));
  }

  fetchDataFromServer = () => {
    this.cleanData();
    this.setState({isLoading: true});
    global.hathorLib.version.checkApiVersion().then(data => {
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
    const tokens = global.localStorage.getItem('wallet:tokens');

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
    global.localStorage.setItem('wallet:tokens', tokens);
  }

  handleWebsocketStateChange = isOnline => {
    if (isOnline === undefined) {
      return;
    }
    if (isOnline) {
      this.props.dispatch(clearNetworkError());
    } else {
      const timestamp = Date.now();
      this.props.dispatch(networkError(timestamp));
    }
  }

  handleWebsocketMsg = wsData => {
    if (wsData.type === "wallet:address_history") {
      //TODO we also have to update some wallet lib data? Lib should do it by itself
      const walletData = hathorLib.wallet.getWalletData();
      const historyTransactions = 'historyTransactions' in walletData ? walletData['historyTransactions'] : {};
      const allTokens = 'allTokens' in walletData ? walletData['allTokens'] : [];
      global.hathorLib.wallet.updateHistoryData(historyTransactions, allTokens, [wsData.history], null, walletData)
      
      const newWalletData = hathorLib.wallet.getWalletData();
      const keys = newWalletData.keys;
      this.props.dispatch(newTx(wsData.history, keys));
    }
  }

  tokenChanged = (token) => {
    this.props.dispatch(updateSelectedToken(token));
    this.fetchDataFromServer();
  }

  render() {
    const colors = ['#eee', 'white'];

    const getValueColor = (item) => {
      if (item.is_voided) return 'black';
      if (item.balance > 0) return '#28a745';
      else if (item.balance < 0) return '#dc3545';
      else return 'black';
    }

    const renderItem = ({item, index}) => {
      return (
        <View style={[mainStyle.listItemWrapper, { backgroundColor: colors[index % 2] }]}>
          <Text style={[mainStyle.dateColumn, mainStyle.listColumn]}>{global.hathorLib.dateFormatter.parseTimestamp(item.timestamp)}</Text>
          <Text style={[mainStyle.idColumn, mainStyle.listColumn]}>{getShortHash(item.tx_id)}</Text>
          <Text style={[mainStyle.valueColumn, {color: getValueColor(item), textAlign: 'left' }]}>{item.is_voided ? '(Voided)' : global.hathorLib.helpers.prettyValue(item.balance)}</Text>
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

    const renderBalance = () => {
      return (
        <View style={{ display: "flex", alignItems: "center" }}>
          <Text style={mainStyle.topText}>Total: {global.hathorLib.helpers.prettyValue(this.props.balance.available + this.props.balance.locked)} {this.props.selectedToken.symbol}</Text>
          <Text style={mainStyle.topText}>Available: {global.hathorLib.helpers.prettyValue(this.props.balance.available)} {this.props.selectedToken.symbol}</Text>
          <Text style={mainStyle.topText}>Locked: {global.hathorLib.helpers.prettyValue(this.props.balance.locked)} {this.props.selectedToken.symbol}</Text>
        </View>
      );
    }

    const renderTokenBarIcon = () => {
      return <FontAwesomeIcon icon={ faExchangeAlt } color='#ccc' />
    }

    return (
      <SafeAreaView style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
        <TokenBar
          navigation={this.props.navigation}
          onChange={this.tokenChanged}
          tokens={this.props.tokens}
          defaultSelected={this.props.selectedToken.uid}
          icon={renderTokenBarIcon()}
          containerStyle={mainStyle.pickerContainerStyle}
        />
        <View style={{ display: "flex", flexDirection: "row", width: "100%", alignItems: "center", justifyContent: "space-around", height: 120, backgroundColor: "#0273a0", padding: 24 }}>
          {!this.state.isLoading && renderBalance()}
          <View style={{ display: "flex", alignItems: "center" }}>
            <View style={{ padding: 4, borderColor: "white", borderWidth: 1, marginBottom: 8 }}>
              <Text style={{ lineHeight: 30, fontWeight: "bold", fontSize: 16, color: 'white' }}>Testnet</Text>
            </View>
          </View>
        </View>
        <View style={{ flex: 1, justifyContent: "center", alignSelf: "stretch" }}>
          {this.state.isLoading && <ActivityIndicator size="large" animating={true} />}
          {!this.state.isLoading && renderTxHistory()}
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
  },
  pickerContainerStyle: {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    height: '100%',
  }
});

export default connect(mapStateToProps)(MainScreen)
