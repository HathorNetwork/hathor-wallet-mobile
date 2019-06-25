import React from "react";
import {
  AppState,
  StyleSheet,
  View,
} from "react-native";
import { connect } from 'react-redux';

import * as Keychain from 'react-native-keychain';

import HathorHeader from '../components/HathorHeader';
import TokenSelect from '../components/TokenSelect';
import SimpleButton from '../components/SimpleButton';

import { loadHistory, newTx, resetData, setTokens, updateSelectedToken, updateLoadHistoryStatus, setIsOnline } from '../actions';
import { setSupportedBiometry, getSupportedBiometry, setBiometryEnabled, isBiometryEnabled } from '../utils';
import OfflineBar from '../components/OfflineBar';
import { LOCK_TIMEOUT, KEYCHAIN_USER } from '../constants';

import hathorLib from '@hathor/wallet-lib';

/**
 * historyLoading {boolean} indicates we're fetching history from server (display spinner)
 * loadHistoryError {boolean} indicates if there's been an error loading tx history
 * tokens {Array} array with all added tokens on this wallet
 * tokensBalance {Object} dict with balance for each token
 * selectedToken {Object} token currently selected by the user
 */
const mapStateToProps = (state) => ({
  historyLoading: state.loadHistoryStatus.loading,
  loadHistoryError: state.loadHistoryStatus.error,
  tokens: state.tokens,
  tokensBalance: state.tokensBalance,
  selectedToken: state.selectedToken,
  isOnline: state.isOnline,
  network: state.serverInfo.network,
})

const mapDispatchToProps = dispatch => {
  return {
    resetData: () => dispatch(resetData()),
    setTokens: (tokens) => dispatch(setTokens(tokens)),
    loadHistory: () => dispatch(loadHistory()),
    newTx: (newElement, keys) => dispatch(newTx(newElement, keys)),
    updateSelectedToken: token => dispatch(updateSelectedToken(token)),
    updateLoadHistoryStatus: (transactions, addresses) => dispatch(updateLoadHistoryStatus(transactions, addresses)),
    setIsOnline: (status) => dispatch(setIsOnline(status)),
  }
}

export class Dashboard extends React.Component {
  static navigatorStyle = { tabBarVisible: false }

  backgroundTime = null;
  appState = 'active';

  componentDidMount() {
    this.getBiometry();
    const words = this.props.navigation.getParam('words', null);
    const pin = this.props.navigation.getParam('pin', null);
    if (words) {
      hathorLib.wallet.executeGenerateWallet(words, '', pin, pin, false);
      Keychain.setGenericPassword(KEYCHAIN_USER, pin, {accessControl: Keychain.ACCESS_CONTROL.BIOMETRY_ANY, acessible: Keychain.ACCESSIBLE.WHEN_UNLOCKED_THIS_DEVICE_ONLY});
    } else {
      hathorLib.WebSocketHandler.setup();
      // user just started the app and wallet was already initialized, so lock screen
      this.pinScreenActive = true;
      this.props.navigation.navigate('PinScreen', {cb: this._onUnlockSuccess});
    }
    hathorLib.WebSocketHandler.on('wallet', this.handleWebsocketMsg);
    hathorLib.WebSocketHandler.on('reload_data', this.fetchDataFromServer);
    hathorLib.WebSocketHandler.on('is_online', this.isOnlineUpdated);
    hathorLib.WebSocketHandler.on('addresses_loaded', this.addressesLoadedUpdate);
    AppState.addEventListener('change', this._handleAppStateChange);
    // We need to update the redux tokens with data from localStorage, so the user doesn't have to add the tokens again
    this.updateReduxTokens();
    this.fetchDataFromServer();
  }

  componentWillUnmount() {
    hathorLib.WebSocketHandler.removeListener('wallet', this.handleWebsocketMsg);
    hathorLib.WebSocketHandler.removeListener('reload_data', this.fetchDataFromServer);
    hathorLib.WebSocketHandler.removeListener('is_online', this.isOnlineUpdated);
    hathorLib.WebSocketHandler.removeListener('addresses_loaded', this.addressesLoadedUpdate);
    AppState.removeEventListener('change', this._handleAppStateChange);
    this.props.resetData();
  }

  componentDidUpdate(prevProps) {
    if (!prevProps.historyLoading && this.props.historyLoading) {
      // started loading
      if (!this.pinScreenActive) {
        // only push if pin screen is not active
        this.props.navigation.navigate('LoadHistoryScreen', {retryMethod: this.fetchDataFromServer});
      }
    }
  }
 
  isOnlineUpdated = (value) => {
    this.props.setIsOnline(value);
  }

  getBiometry = () => {
    Keychain.getSupportedBiometryType().then(biometryType => {
      switch (biometryType) {
        case Keychain.BIOMETRY_TYPE.TOUCH_ID:
          setSupportedBiometry(biometryType);
          break;
        default:
          setSupportedBiometry(null);
        // XXX Android Fingerprint is still not supported in the react native lib we're using.
        // https://github.com/oblador/react-native-keychain/pull/195
        //case Keychain.BIOMETRY_TYPE.FINGERPRINT:
        // XXX iOS FaceID also not working
        //case Keychain.BIOMETRY_TYPE.FACE_ID:
      }
    });
  }

  _onUnlockSuccess = () => {
    this.backgroundTime = null;
    this.pinScreenActive = false;
    if (this.props.historyLoading || this.props.loadHistoryError) {
      // push loading screen
      this.props.navigation.navigate('LoadHistoryScreen', {retryMethod: this.fetchDataFromServer});
    }
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
        this.pinScreenActive = true;
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

  /**
   * Method called when WebSocket receives a message after loading address history
   * We just update redux data with new loading info
   *
   * @param {Object} data Object with {'historyTransactions', 'addressesFound'}
   */
  addressesLoadedUpdate = (data) => {
    // Update redux with loaded data
    this.props.updateLoadHistoryStatus(Object.keys(data.historyTransactions).length, data.addressesFound);
  }

  onItemPress = (item) => {
    this.props.updateSelectedToken(item);
    this.props.navigation.navigate('MainScreen');
  }

  render() {
    const ManualInfoButton = () => (
      <SimpleButton 
        title='Register token'
        onPress={() => this.props.navigation.navigate('RegisterToken')}
      />
    )

    const Header = () => (
      <HathorHeader
        title='TOKENS'
        wrapperStyle={{ borderBottomWidth: 0 }}
        rightElement={<ManualInfoButton/>}
      />
    )

    return (
      <View style={{flex: 1}}>
        <TokenSelect
          header=<Header/>
          renderArrow={true}
          onItemPress={this.onItemPress}
          selectedToken={this.props.selectedToken}
          tokens={this.props.tokens}
          tokensBalance={this.props.tokensBalance}
        />
        <OfflineBar />
      </View>
    );
  }
}

export default connect(mapStateToProps, mapDispatchToProps)(Dashboard);
