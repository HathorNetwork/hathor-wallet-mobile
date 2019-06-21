import React from 'react';
import {
  ActivityIndicator,
  AppState,
  FlatList,
  SafeAreaView,
  StyleSheet,
  Text,
  View,
  Image,
  TouchableWithoutFeedback,
  TouchableHighlight
} from 'react-native';
import { connect } from 'react-redux';
import * as Keychain from 'react-native-keychain';

import { FontAwesomeIcon } from '@fortawesome/react-native-fontawesome';
import { faExchangeAlt } from '@fortawesome/free-solid-svg-icons';
import { loadHistory, newTx, resetData, setTokens, updateSelectedToken } from '../actions';
import HathorButton from '../components/HathorButton';
import HathorHeader from '../components/HathorHeader';
import SimpleButton from '../components/SimpleButton';
import TokenBar from '../components/TokenBar';
import TxDetailsModal from '../components/TxDetailsModal';
import { getShortHash, setSupportedBiometry, getSupportedBiometry, setBiometryEnabled, isBiometryEnabled } from '../utils';
import { LOCK_TIMEOUT } from '../constants';
import moment from 'moment';

import hathorLib from '@hathor/wallet-lib';


/**
 * txList {Array} array with transactions of the selected token
 * balance {Object} object with token balance {'available', 'locked'}
 * loadHistoryError {boolean} indicates if there's been an error loading tx history
 * historyLoading {boolean} indicates we're fetching history from server (display spinner)
 * selectedToken {string} uid of the selected token
 * tokens {Array} array with all added tokens on this wallet
 */
const mapStateToProps = (state) => ({
  txList: state.tokensHistory[state.selectedToken.uid] || [],
  balance: state.tokensBalance[state.selectedToken.uid] || {available: 0, locked: 0},
  loadHistoryError: state.loadHistoryError,
  historyLoading: state.historyLoading,
  selectedToken: state.selectedToken,
  tokens: state.tokens
})

const mapDispatchToProps = dispatch => {
  return {
    resetData: () => dispatch(resetData()),
    setTokens: (tokens) => dispatch(setTokens(tokens)),
    loadHistory: () => dispatch(loadHistory()),
    newTx: (newElement, keys) => dispatch(newTx(newElement, keys)),
    updateSelectedToken: token => dispatch(updateSelectedToken(token)),
  }
}

class MainScreen extends React.Component {
  /**
   * isLoading {boolean} It is true if the app is still loading
   *
   * modal {Optional[Modal]}
   *   It is null if there is no modal to be shown.
   *   It must be set to the Modal object to be shown. It can by any modal.
   *   Currently, it is used to show the TxDetailsModal.
   */
  state = {
    // {boolean} if should show list or spinner
    isLoading: true,
    modal: null,
  };

  style = StyleSheet.create({
    pickerContainerStyle: {
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      height: '100%',
    }
  });

  constructor(props) {
    super(props);
    this.backgroundTime = null;
    this.appState = 'active';
  }

  componentDidMount() {
    this.getBiometry();
    const words = this.props.navigation.getParam('words', null);
    const pin = this.props.navigation.getParam('pin', null);
    if (words) {
      hathorLib.wallet.executeGenerateWallet(words, '', pin, pin, false);
      Keychain.setGenericPassword('', pin, {accessControl: Keychain.ACCESS_CONTROL.BIOMETRY_ANY, acessible: Keychain.ACCESSIBLE.WHEN_UNLOCKED_THIS_DEVICE_ONLY});
    } else {
      hathorLib.WebSocketHandler.setup();
      // user just started the app and wallet was already initialized, so lock screen
      this.props.navigation.navigate('PinScreen', {cb: this._onUnlockSuccess});
    }
    hathorLib.WebSocketHandler.on('wallet', this.handleWebsocketMsg);
    hathorLib.WebSocketHandler.on('reload_data', this.fetchDataFromServer);
    AppState.addEventListener('change', this._handleAppStateChange);
    // We need to update the redux tokens with data from localStorage, so the user doesn't have to add the tokens again
    this.updateReduxTokens();
    this.fetchDataFromServer();
  }

  componentWillUnmount() {
    hathorLib.WebSocketHandler.removeListener('wallet', this.handleWebsocketMsg);
    hathorLib.WebSocketHandler.removeListener('reload_data', this.fetchDataFromServer);
    AppState.removeEventListener('change', this._handleAppStateChange);
    this.props.resetData();
  }
 
  getBiometry = () => {
    Keychain.getSupportedBiometryType().then(biometryType => {
      switch (biometryType) {
        case Keychain.BIOMETRY_TYPE.TOUCH_ID:
        case Keychain.BIOMETRY_TYPE.FACE_ID:
          setSupportedBiometry(biometryType);
          break;
        default:
          setSupportedBiometry(null);
        // XXX Android Fingerprint is still not supported in the react native lib we're using.
        // https://github.com/oblador/react-native-keychain/pull/195
        //case Keychain.BIOMETRY_TYPE.FINGERPRINT:
      }
    });
  }

  _onUnlockSuccess = () => {
    this.backgroundTime = null;
  }

  _handleAppStateChange = (nextAppState) => {
    if (nextAppState === 'active') {
      if (this.appState === 'inactive') {
        // inactive state means the app wasn't in background, so no need to lock
        // the screen. This happens when user goes to app switch view or maybe is
        // asked for fingerprint or face if
        this.backgroundTime = null;
      } else if (Date.now() - this.backgroundTime > LOCK_TIMEOUT) {
        // this means app was in background for more than LOCK_TIMEOUT seconds,
        // so display lock screen
        this.props.navigation.navigate('PinScreen', {cb: this._onUnlockSuccess});
      } else {
        this.backgroundTime = null;
      }
    } else if (this.backgroundTime === null) {
      // app is leaving active state. Save timestamp to check if we need to lock
      // screen when it becomes active again
      this.backgroundTime = Date.now();
    }
    this.appState = nextAppState;
  }

  updateReduxTokens = () => {
    this.props.setTokens(hathorLib.tokens.getTokens());
  }

  fetchDataFromServer = () => {
    this.cleanData();
    this.props.loadHistory();
  }

  cleanData = () => {
    // Get old access data
    const accessData = hathorLib.storage.getItem('wallet:accessData');
    const walletData = hathorLib.wallet.getWalletData();
    const server = hathorLib.storage.getItem('wallet:server');
    const tokens = hathorLib.storage.getItem('wallet:tokens');

    const biometryEnabled = isBiometryEnabled();
    const supportedBiometry = getSupportedBiometry();
    hathorLib.storage.clear();

    let newWalletData = {
      keys: {},
      xpubkey: walletData.xpubkey,
    }

    hathorLib.storage.setItem('wallet:accessData', accessData);
    hathorLib.storage.setItem('wallet:data', newWalletData);
    hathorLib.storage.setItem('wallet:server', server);
    hathorLib.storage.setItem('wallet:tokens', tokens);
    setBiometryEnabled(biometryEnabled);
    setSupportedBiometry(supportedBiometry);
  }

  handleWebsocketMsg = wsData => {
    if (wsData.type === "wallet:address_history") {
      //TODO we also have to update some wallet lib data? Lib should do it by itself
      const walletData = hathorLib.wallet.getWalletData();
      const historyTransactions = 'historyTransactions' in walletData ? walletData['historyTransactions'] : {};
      const allTokens = 'allTokens' in walletData ? walletData['allTokens'] : [];
      hathorLib.wallet.updateHistoryData(historyTransactions, allTokens, [wsData.history], null, walletData)
      
      const newWalletData = hathorLib.wallet.getWalletData();
      const keys = newWalletData.keys;
      this.props.newTx(wsData.history, keys);
    }
  }

  tokenChanged = (token) => {
    this.props.updateSelectedToken(token);
  }

  closeTxDetails = () => {
    this.setState({modal: null});
  }

  onTxPress = (tx) => {
    const txDetailsModal = (
      <TxDetailsModal
        tx={tx}
        token={this.props.selectedToken}
        onRequestClose={this.closeTxDetails}
      />
    );
    this.setState({modal: txDetailsModal});
  }

  tokenInfo = () => {
    if (this.props.selectedToken.uid !== hathorLib.constants.HATHOR_TOKEN_CONFIG.uid) {
      this.props.navigation.navigate('TokenDetail');
    }
  }

  render() {
    const renderTxHistory = () => {
      if (this.props.txList && (this.props.txList.length > 0)) {
        return (
          <TxHistoryView txList={this.props.txList} token={this.props.selectedToken} onTxPress={this.onTxPress} />
        );
      } else if (!this.props.historyLoading && !this.props.loadHistoryError) {
        //empty history
        return <Text style={{ fontSize: 16, textAlign: "center" }}>You don't have any transactions</Text>;
      } else if (!this.props.historyLoading && this.props.loadHistoryError) {
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

    const renderTokenBarIcon = () => {
      return <FontAwesomeIcon icon={ faExchangeAlt } color='#ccc' />
    }

    const renderRightElement = () => {
      if (this.props.selectedToken.uid !== hathorLib.constants.HATHOR_TOKEN_CONFIG.uid) {
        return (
          <SimpleButton
            icon={require('../assets/icons/icMoreActive.png')}
            onPress={this.tokenInfo}
          />
        );
      }

      return null;
    }

    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: '#F7F7F7', justifyContent: "center", alignItems: "center" }}>
        {this.state.modal}
        <HathorHeader
          title={this.props.selectedToken.name.toUpperCase()}
          onBackPress={() => this.props.navigation.goBack()}
          rightElement={renderRightElement()}
          wrapperStyle={{ borderBottomWidth: 0 }}
        />
        <TokenBar
          key={this.props.selectedToken.uid}
          navigation={this.props.navigation}
          onChange={this.tokenChanged}
          tokens={this.props.tokens}
          defaultSelected={this.props.selectedToken.uid}
          icon={renderTokenBarIcon()}
          containerStyle={this.style.pickerContainerStyle}
        />
        <BalanceView network={"testnet: alpha"} balance={this.props.balance} token={this.props.selectedToken} />
        <View style={{ flex: 1, justifyContent: "center", alignSelf: "stretch" }}>
          {this.props.historyLoading && <ActivityIndicator size="large" animating={true} />}
          {!this.props.historyLoading && renderTxHistory()}
        </View>
      </SafeAreaView>
    );
  }
}

class TxHistoryView extends React.Component {
  renderItem = ({item, index}) => {
    const isFirst = (index == 0);
    const isLast = (index == (this.props.txList.length - 1));
    return <TxListItem item={item} isFirst={isFirst} isLast={isLast} token={this.props.token} onTxPress={this.props.onTxPress} />
  }

  render() {
    return (
      <View style={{ flex: 1, alignSelf: "stretch" }}>
        <FlatList
          data={this.props.txList}
          renderItem={this.renderItem}
          keyExtractor={(item, index) => item.tx_id}
        />
      </View>
    );
  }
}

class TxListItem extends React.Component {
  state = {timestamp: null};

  style = StyleSheet.create({
    container: {
      marginLeft: 16,
      marginRight: 16,
      marginTop: 0,
      marginBottom: 2,
    },
    view: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: 'white',
      height: 80,
    },
    firstItemBorder: {
      borderTopLeftRadius: 16,
      borderTopRightRadius: 16,
    },
    lastItemBorder: {
      borderBottomLeftRadius: 16,
      borderBottomRightRadius: 16,
    },
    middleView: {
      flex: 1,
    },
    icon: {
      marginLeft: 16,
      marginRight: 16,
      width: 24,
      height: 24,
    },
    balance: {
      fontSize: 16,
      marginRight: 16,
    },
    description: {
      fontSize: 14,
      lineHeight: 20,
      fontWeight: 'bold',
    },
    timestamp: {
      fontSize: 12,
      lineHeight: 20,
      color: 'rgba(0, 0, 0, 0.5)',
    },
  });

  styleVoided = Object.assign({}, this.style, StyleSheet.create({
    description: {
      ...this.style.description,
      color: 'rgba(0, 0, 0, 0.3)',
    },
    timestamp: {
      ...this.style.timestamp,
      color: 'rgba(0, 0, 0, 0.3)',
    },
    balance: {
      ...this.style.balance,
      color: 'rgba(0, 0, 0, 0.3)',
      textDecorationLine: 'line-through',
    },
  }));

  stylePositive = Object.assign({}, this.style, StyleSheet.create({
    balance: {
      ...this.style.balance,
      color: '#0DA0A0',
      fontWeight: 'bold',
    },
  }));

  componentDidMount() {
    this.updateTimestamp();
  }

  componentWillUnmount() {
    if (this.interval) {
      clearInterval(this.interval);
    }
  }

  updateTimestamp = () => {
    const timestamp = this.props.item.getTimestampCalendar();
    if (timestamp !== this.state.timestamp) {
      this.setState({timestamp});
    }

    const diff = moment.unix(this.props.item.timestamp).diff(moment(), 'days', true);
    if (!this.interval && diff >= -6) {
      // Schedule if the transaction timestamp is less than 6 days.
      this.interval = setInterval(this.updateTimestamp, 10000);
    } else if (this.interval && diff < -6) {
      // Otherwise, the timestamp text will never be updated.
      clearInterval(this.interval);
      this.interval = null;
    }
  }

  getImage(item) {
    if (item.balance === 0) {
      return <View style={this.style.icon} />;
    }
    let icon;
    if (item.is_voided) {
      if (item.balance > 0) {
        // TODO Replace by receive-inactive.png when image is available.
        icon = require('../assets/icons/send-inactive.png');
      } else if (item.balance < 0) {
        icon = require('../assets/icons/send-inactive.png');
      } else {
        throw "should not happen";
      }
    } else {
      if (item.balance > 0) {
        icon = require('../assets/icons/receive-active.png');
      } else if (item.balance < 0) {
        icon = require('../assets/icons/send-active.png');
      } else {
        throw "should not happen";
      }
    }
    return <Image style={this.style.icon} source={icon} width={24} height={24} />;
  }

  getStyle(item) {
    if (item.is_voided) {
      return this.styleVoided;

    } else if (item.balance > 0) {
      return this.stylePositive;

    } else {
      return this.style;
    }
  }

  getDescription(item) {
    return item.getDescription(this.props.token);
  }

  onItemPress(item) {
    this.props.onTxPress(item);
  }

  render() {
    const item = this.props.item;
    const style = this.getStyle(item);
    const image = this.getImage(item);

    const viewStyle = [style.view];
    const touchStyle = [];
    if (this.props.isFirst) {
      viewStyle.push(style.firstItemBorder);
      touchStyle.push(style.firstItemBorder);
    }
    if (this.props.isLast) {
      viewStyle.push(style.lastItemBorder);
      touchStyle.push(style.lastItemBorder);
    }

    const balanceStr = hathorLib.helpers.prettyValue(item.balance);
    const description = item.getDescription(this.props.token);
    const timestamp = this.state.timestamp;
    return (
      <View style={style.container}>
        <TouchableHighlight style={touchStyle} onPress={() => this.onItemPress(item)}>
          <View style={viewStyle}>
            {image}
            <View style={style.middleView}>
              <Text style={style.description}>{description}</Text>
              <Text style={style.timestamp}>{timestamp}</Text>
            </View>
            <Text style={style.balance} numberOfLines={1}>{balanceStr}</Text>
          </View>
        </TouchableHighlight>
      </View>
    )
  }
}

class BalanceView extends React.Component {
  state = {
    isExpanded: false,
  };

  style = StyleSheet.create({
    toucharea: {
      alignSelf: 'stretch',
    },
    center: {
      alignItems: 'center',
    },
    view: {
      paddingTop: 32,
      paddingLeft: 54,
      paddingRight: 54,
    },
    balanceLocked: {
      marginTop: 24,
      fontSize: 18,
      fontWeight: 'bold',
    },
    balanceAvailable: {
      fontSize: 32,
      fontWeight: 'bold',
    },
    text1: {
      paddingTop: 8,
      fontSize: 12,
      fontWeight: 'bold',
      color: 'rgba(0, 0, 0, 0.5)',
    },
    expandButton: {
      marginTop: 24,
      marginBottom: 24,
    },
    networkView: {
      backgroundColor: 'rgba(227, 0, 82, 0.1)',
      padding: 8,
      marginTop: 32,
      borderRadius: 8,
    },
    networkText: {
      color: '#E30052',
      fontSize: 16,
      fontWeight: 'bold',
    },
  });

  toggleExpanded = () => {
    this.setState({isExpanded: !this.state.isExpanded});
  }

  renderExpanded() {
    const availableStr = hathorLib.helpers.prettyValue(this.props.balance.available);
    const lockedStr = hathorLib.helpers.prettyValue(this.props.balance.locked);
    const network = this.props.network;
    const token = this.props.token;
    const style = this.style;
    return (
      <View style={style.center}>
        <Text style={style.balanceAvailable} adjustsFontSizeToFit={true} minimumFontScale={0.5} numberOfLines={1}>
          {availableStr} {token.symbol}
        </Text>
        <Text style={style.text1}>Available Balance</Text>
        <Text style={style.balanceLocked} adjustsFontSizeToFit={true} minimumFontScale={0.5} numberOfLines={1}>
          {lockedStr} {token.symbol}
        </Text>
        <Text style={style.text1}>Locked</Text>
        <View style={style.networkView}>
          <Text style={style.networkText}>{network}</Text>
        </View>
        <Image style={style.expandButton} source={require('../assets/icons/chevron-up.png')} width={12} height={7} />
      </View>
    );
  }

  renderSimple() {
    const availableStr = hathorLib.helpers.prettyValue(this.props.balance.available);
    const token = this.props.token;
    const style = this.style;
    return (
      <View style={style.center}>
        <Text style={style.balanceAvailable} adjustsFontSizeToFit={true} minimumFontScale={0.5} numberOfLines={1}>
          {availableStr} {token.symbol}
        </Text>
        <Text style={style.text1}>Available Balance</Text>
        <Image style={style.expandButton} source={require('../assets/icons/chevron-down.png')} width={12} height={7} />
      </View>
    );
  }

  render() {
    const style = this.style;
    return (
      <TouchableWithoutFeedback style={style.toucharea} onPress={this.toggleExpanded}>
        <View style={style.view}>
          {!this.state.isExpanded
            ? this.renderSimple()
            : this.renderExpanded()
          }
        </View>
      </TouchableWithoutFeedback>
    );
  }
}


export default connect(mapStateToProps, mapDispatchToProps)(MainScreen)
