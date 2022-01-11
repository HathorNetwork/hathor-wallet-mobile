/**
 * Copyright (c) Hathor Labs and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import '../shim';

import React from 'react';
import { AppState, StyleSheet, View } from 'react-native';
import {
  createBottomTabNavigator, createStackNavigator, createSwitchNavigator, createAppContainer,
} from 'react-navigation';
import { Provider, connect } from 'react-redux';
import * as Keychain from 'react-native-keychain';

import hathorLib from '@hathor/wallet-lib';
import IconTabBar from './icon-font';
import NavigationService from './NavigationService';
import { IS_MULTI_TOKEN, PRIMARY_COLOR, LOCK_TIMEOUT } from './constants';
import { setSupportedBiometry } from './utils';
import {
  resetData, lockScreen, setTokens
} from './actions';
import { store } from './reducer';

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
import ErrorModal from './components/ErrorModal';


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
  ChangePin,
  ResetWallet,
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
});

const mapDispatchToProps = (dispatch) => ({
  setTokens: (tokens) => dispatch(setTokens(tokens)),
  lockScreen: () => dispatch(lockScreen()),
  resetData: () => dispatch(resetData()),
});

class _AppStackWrapper extends React.Component {
  static router = AppStack.router;

  backgroundTime = null;

  appState = 'active';

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

  componentDidMount = () => {
    this.getBiometry();
    AppState.addEventListener('change', this._handleAppStateChange);
    this.updateReduxTokens();
  }

  componentWillUnmount = () => {
    AppState.removeEventListener('change', this._handleAppStateChange);
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
          setSupportedBiometry(biometryType);
          break;
        default:
          setSupportedBiometry(null);
        // XXX Android Fingerprint is still not supported in the react native lib we're using.
        // https://github.com/oblador/react-native-keychain/pull/195
        // case Keychain.BIOMETRY_TYPE.FINGERPRINT:
        // XXX iOS FaceID also not working
        // case Keychain.BIOMETRY_TYPE.FACE_ID:
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
    if (nextAppState === 'active') {
      if (this.appState === 'inactive') {
        // inactive state means the app wasn't in background, so no need to lock
        // the screen. This happens when user goes to app switch view or maybe is
        // asked for fingerprint or face if
        this.backgroundTime = null;
      } else if (Date.now() - this.backgroundTime > LOCK_TIMEOUT) {
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

      if (this.props.loadHistory || this.props.isScreenLocked) {
        return (
          <View style={this.style.auxView}>
            { screen }
          </View>
        );
      }
      return null;
    };

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
    <NavigationContainer ref={(navigatorRef) => NavigationService.setTopLevelNavigator(navigatorRef)} />
    <ErrorModal />
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
