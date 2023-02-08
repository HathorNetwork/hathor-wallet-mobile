/**
 * Copyright (c) Hathor Labs and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import '../shim';

import React from 'react';
import { AppState, StyleSheet, View } from 'react-native';
import { createSwitchNavigator, createAppContainer, } from 'react-navigation';
import { createStackNavigator } from 'react-navigation-stack';
import { createBottomTabNavigator } from 'react-navigation-tabs';
import { Provider, connect } from 'react-redux';
import * as Keychain from 'react-native-keychain';
import DeviceInfo from 'react-native-device-info';
import notifee, { EventType } from '@notifee/react-native';

import hathorLib from '@hathor/wallet-lib';

import IconTabBar from './icon-font';
import NavigationService from './NavigationService';
import { IS_MULTI_TOKEN, PRIMARY_COLOR, LOCK_TIMEOUT, PUSH_ACTION } from './constants';
import { setSupportedBiometry } from './utils';
import {
  resetData,
  lockScreen,
  setTokens,
  pushTxDetailsRequested,
  onExceptionCaptured,
} from './actions';
import { store } from './reducer';
import { GlobalErrorHandler } from './components/GlobalErrorModal';

import DecideStackScreen from './screens/DecideStackScreen';
import {
  WelcomeScreen, InitialScreen, NewWordsScreen, LoadWordsScreen,
} from './screens/InitWallet';
import ChoosePinScreen from './screens/ChoosePinScreen';
import BackupWords from './screens/BackupWords';
import MainScreen from './screens/MainScreen';
import SendScanQRCode from './screens/SendScanQRCode';
import SendAddressInput from './screens/SendAddressInput';
import SendAmountInput from './screens/SendAmountInput';
import SendConfirmScreen from './screens/SendConfirmScreen';
import ChangeToken from './screens/ChangeToken';
import ReceiveScreen from './screens/Receive';
import PaymentRequestDetail from './screens/PaymentRequestDetail';
import RegisterToken from './screens/RegisterToken';
import RegisterTokenManual from './screens/RegisterTokenManual';
import Settings from './screens/Settings';
import TokenDetail from './screens/TokenDetail';
import RecoverPin from './screens/RecoverPin';
import UnregisterToken from './screens/UnregisterToken';
import PinScreen from './screens/PinScreen';
import About from './screens/About';
import Security from './screens/Security';
import PushNotification from './screens/PushNotification';
import ChangePin from './screens/ChangePin';
import ResetWallet from './screens/ResetWallet';
import Dashboard from './screens/Dashboard';
import LoadHistoryScreen from './screens/LoadHistoryScreen';
import CreateTokenDepositNotice from './screens/CreateTokenDepositNotice';
import CreateTokenName from './screens/CreateTokenName';
import CreateTokenSymbol from './screens/CreateTokenSymbol';
import CreateTokenAmount from './screens/CreateTokenAmount';
import CreateTokenConfirm from './screens/CreateTokenConfirm';
import CreateTokenDetail from './screens/CreateTokenDetail';
import LoadWalletErrorScreen from './screens/LoadWalletErrorScreen';
import { WALLET_STATUS } from './sagas/wallet';


const InitStack = createStackNavigator(
  {
    WelcomeScreen,
    InitialScreen,
    NewWordsScreen,
    LoadWordsScreen,
    BackupWords,
    ChoosePinScreen,
  },
  {
    initialRouteName: 'WelcomeScreen',
    headerMode: 'none',
  }
);

const DashboardStack = createStackNavigator(
  {
    Dashboard,
    MainScreen,
  },
  {
    initialRouteName: 'Dashboard',
    headerMode: 'none',
  },
);

const SendStack = createStackNavigator(
  {
    SendScanQRCode,
    SendAddressInput,
    SendAmountInput,
    SendConfirmScreen,
  },
  {
    initialRouteName: 'SendScanQRCode',
    headerMode: 'none',
  },
);

const CreateTokenStack = createStackNavigator(
  {
    CreateTokenDepositNotice,
    CreateTokenName,
    CreateTokenSymbol,
    CreateTokenAmount,
    CreateTokenConfirm,
    CreateTokenDetail,
  },
  {
    initialRouteName: 'CreateTokenDepositNotice',
    headerMode: 'none',
  }
);

const RegisterTokenStack = createStackNavigator(
  {
    RegisterToken,
    RegisterTokenManual,
  },
  {
    initialRouteName: 'RegisterToken',
    headerMode: 'none',
  },
);

const tabBarIconMap = {
  Home: 'icDashboard',
  Send: 'icSend',
  Receive: 'icReceive',
  Settings: 'icSettings',
};

/**
 * This workaround is similar to the one in TokenSelect.js
 *
 * It should be removed after we upgrade react-navigation to
 * to use the latest version of SafeAreaView
 */
const tabNavigatorMarginWorkaround = () => {
  const deviceId = DeviceInfo.getDeviceId();
  const workaroundDeviceIds = [
    'iPhone13,2', // iPhone 12
    'iPhone13,3', // iPhone 12 Pro
    'iPhone13,4', // iPhone 12 Pro Max
    'iPhone14,5', // iPhone 13
    'iPhone14,2', // iPhone 13 Pro
    'iPhone14,3', // iPhone 13 Pro Max
    'iPhone14,7', // iPhone 14
    'iPhone14,8', // iPhone 14 Plus
    'iPhone15,2', // iPhone 14 Pro
    'iPhone15,3', // iPhone 14 Pro Max
  ];

  return workaroundDeviceIds.includes(deviceId);
};

const TabNavigator = createBottomTabNavigator({
  Home: (IS_MULTI_TOKEN ? DashboardStack : MainScreen),
  Send: SendStack,
  Receive: ReceiveScreen,
  Settings,
}, {
  initialRoute: 'Home',
  tabBarOptions: {
    activeTintColor: PRIMARY_COLOR,
    inactiveTintColor: 'rgba(0, 0, 0, 0.5)',
    style: {
      paddingTop: 12,
      paddingBottom: 12,
      ...(tabNavigatorMarginWorkaround() ? { marginBottom: 34 } : {})
    },
    tabStyle: {
      justifyContent: 'center',
    },
    showIcon: true,
    showLabel: false,
  },
  defaultNavigationOptions: ({ navigation }) => ({
    tabBarIcon: ({ tintColor }) => {
      const { routeName } = navigation.state;
      const iconName = tabBarIconMap[routeName];
      return <IconTabBar name={iconName} size={24} color={tintColor} />;
    },
  }),
});

const disableSwipeDown = () => ({
  gesturesEnabled: false,
});

const AppStack = createStackNavigator({
  Main: TabNavigator,
  About,
  Security,
  PushNotification,
  ChangePin,
  ResetWallet: {
    screen: ResetWallet,
    // Dismissing the screen on ResetWallet would lead to a
    // MainScreen with broken state if started from the PinScreen,
    // so just disable the swipeDown animation
    navigationOptions: disableSwipeDown,
  },
  PaymentRequestDetail,
  RegisterToken: RegisterTokenStack,
  ChangeToken,
  PinScreen: {
    screen: PinScreen,
    navigationOptions: disableSwipeDown,
  },
  CreateTokenStack,
  TokenDetail,
  UnregisterToken,
}, {
  mode: 'modal',
  headerMode: 'none',
});


/**
 * loadHistory {bool} Indicates we're loading the tx history
 * lockScreen {bool} Indicates screen is locked
 */
const mapStateToProps = (state) => ({
  loadHistory: state.loadHistoryStatus.active,
  isScreenLocked: state.lockScreen,
  isRecoveringPin: state.recoveringPin,
  walletStartState: state.walletStartState,
});

const mapDispatchToProps = (dispatch) => ({
  setTokens: (tokens) => dispatch(setTokens(tokens)),
  lockScreen: () => dispatch(lockScreen()),
  resetData: () => dispatch(resetData()),
  loadTxDetails: (txId) => dispatch(pushTxDetailsRequested(txId)),
  captureError: (error) => dispatch(onExceptionCaptured(error)),
});

class _AppStackWrapper extends React.Component {
  static router = AppStack.router;

  backgroundTime = null;

  appState = 'active';

  // Event subscription for app state change
  appStateChangeEventSub = null;

  style = StyleSheet.create({
    auxView: {
      backgroundColor: 'white',
      position: 'absolute',
      top: 0,
      bottom: 0,
      left: 0,
      right: 0,
      zIndex: 100,
    },
  });

  /**
   * This method set the listener for the notifee foreground event
   */
  setNotifeeForegroundListener = () => {
    try {
      const onForegroundMessage = async ({ type, detail }) => {
        switch (type) {
          case EventType.PRESS:
            try {
              if (detail.pressAction?.id === PUSH_ACTION.NEW_TRANSACTION) {
                const { txId } = detail.notification.data;
                this.props.loadTxDetails({ txId });
              }
            } catch (error) {
              console.error('Error processing notification press event.', error);
              this.props.captureError(error);
            }
            break;
          default:
            // to nothing
        }
      };
      notifee.onForegroundEvent(onForegroundMessage);
    } catch (error) {
      console.error('Error setting notifee foreground event listener.', error);
    }
  }

  componentDidMount = async () => {
    this.getBiometry();
    this.appStateChangeEventSub = AppState.addEventListener('change', this._handleAppStateChange);
    this.updateReduxTokens();
    // We need the version of the app in the user agent to get some stats from the logs
    // this method getVersion returns a string in the format <major>.<minor>.<patch>
    const version = DeviceInfo.getVersion();
    // We use this string to parse the version from user agent
    // in some of our services, so changing this might break another service
    hathorLib.config.setUserAgent(`Hathor Wallet Mobile / ${version}`);
    // set notification foreground listener
    this.setNotifeeForegroundListener();
  }

  componentWillUnmount = () => {
    if (this.appStateChangeEventSub) {
      this.appStateChangeEventSub.remove();
      this.appStateChangeEventSub = null;
    }
    this.props.resetData();
  }

  componentDidUpdate(prevProps) {
    if (prevProps.isScreenLocked && !this.props.isScreenLocked) {
      this.backgroundTime = null;
    }
  }

  /**
   * Gets the supported biometry (if any) and save the result
   */
  getBiometry = () => {
    Keychain.getSupportedBiometryType().then((biometryType) => {
      switch (biometryType) {
        case Keychain.BIOMETRY_TYPE.TOUCH_ID:
        case Keychain.BIOMETRY_TYPE.FINGERPRINT:
        case Keychain.BIOMETRY_TYPE.FACE_ID:
          setSupportedBiometry(biometryType);
          break;
        default:
          setSupportedBiometry(null);
      }
    });
  }

  /**
   * Update tokens on redux with data from storage, so user doesn't need to add the tokens again
   */
  updateReduxTokens = () => {
    this.props.setTokens(hathorLib.tokens.getTokens());
  }

  /**
   * Handles when app changes its state to/from background and foreground.
   *
   * More info: https://reactnative.dev/docs/appstate
   */
  _handleAppStateChange = (nextAppState) => {
    if (this.appState === nextAppState) {
      // As per the Apple lifecycle documentation, an active → active state
      // transition should never happen, but we observed this happening in production
      // builds on a very specific situation, described in
      // https://github.com/HathorNetwork/internal-issues/issues/144 so we should ignore
      // all transitions that are not changing
      console.warn(`App transition from ${this.appState} to ${nextAppState}. This should never happen.`);
      return;
    }

    if (nextAppState === 'active') {
      if (this.appState === 'inactive') {
        // inactive state means the app wasn't in background, so no need to lock
        // the screen. This happens when user goes to app switch view or maybe is
        // asked for fingerprint or face if
        this.backgroundTime = null;

        // We must guarantee backgroundTime is not null because javascript considers null to be 0
        // in a subtraction
      } else if (this.backgroundTime != null && (Date.now() - this.backgroundTime > LOCK_TIMEOUT)) {
        // this means app was in background for more than LOCK_TIMEOUT seconds,
        // so display lock screen
        this.props.lockScreen();
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

  render() {
    const renderAuxiliarViews = () => {
      // the auxiliar view needs to be rendered after the other views, or it won't be visible
      // on Android: https://github.com/facebook/react-native/issues/14555
      let screen = null;

      if (!this.props.isRecoveringPin) {
        if (this.props.isScreenLocked) {
          screen = <PinScreen isLockScreen navigation={this.props.navigation} />;
        } else {
          screen = <LoadHistoryScreen />;
        }
      } else {
        screen = <RecoverPin navigation={this.props.navigation} />;
      }

      if (this.props.walletStartState === WALLET_STATUS.LOADING || this.props.isScreenLocked) {
        return (
          <View style={this.style.auxView}>
            { screen }
          </View>
        );
      }

      return null;
    };

    if (this.props.walletStartState === WALLET_STATUS.FAILED) {
      return (
        <LoadWalletErrorScreen />
      );
    }

    return (
      <View style={{ flex: 1 }}>
        <AppStack navigation={this.props.navigation} />
        {renderAuxiliarViews()}
      </View>
    );
  }
}

const AppStackWrapper = connect(mapStateToProps, mapDispatchToProps)(_AppStackWrapper);

const SwitchNavigator = createSwitchNavigator({
  Decide: DecideStackScreen,
  App: AppStackWrapper,
  Init: InitStack,
}, {
  initialRouteName: 'Decide',
});

const NavigationContainer = createAppContainer(SwitchNavigator);

const App = () => (
  <Provider store={store}>
    <NavigationContainer
      ref={(navigatorRef) => NavigationService.setTopLevelNavigator(navigatorRef)}
    />
    <GlobalErrorHandler />
  </Provider>
);

// custom interceptor for axios
const createRequestInstance = (resolve, timeout) => {
  const instance = hathorLib.axios.defaultCreateRequestInstance(resolve, timeout);

  instance.interceptors.response.use((response) => response, (error) => Promise.reject(error));
  return instance;
};
hathorLib.axios.registerNewCreateRequestInstance(createRequestInstance);

export default App;
