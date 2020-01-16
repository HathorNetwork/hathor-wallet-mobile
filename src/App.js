/**
 * Copyright (c) Hathor Labs and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import '../shim';

import React from 'react';
import { StyleSheet, View } from 'react-native';
import {
  createBottomTabNavigator, createStackNavigator, createSwitchNavigator, createAppContainer,
} from 'react-navigation';
import { Provider, connect } from 'react-redux';

import hathorLib from '@hathor/wallet-lib';
import IconTabBar from './icon-font';
import { HATHOR_COLOR } from './constants';
import { updateHeight } from './actions';

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
  Home: DashboardStack,
  Send: SendStack,
  Receive: ReceiveScreen,
  Settings,
}, {
  initialRoute: 'Home',
  tabBarOptions: {
    activeTintColor: HATHOR_COLOR,
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
  lockScreen: state.lockScreen,
});

const mapDispatchToProps = (dispatch) => ({
  updateHeight: (height) => dispatch(updateHeight(height)),
});

export class _AppStackWrapper extends React.Component {
  static router = AppStack.router;

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
    hathorLib.WebSocketHandler.on('height_updated', this.handleHeightUpdated);
  }

  componentWillUnmount = () => {
    hathorLib.WebSocketHandler.removeListener('height_updated', this.handleHeightUpdated);
  }

  /**
   * Method called when WebSocketHandler from lib emits a height_updated event
   * We update the height of the network in redux
   *
   * @param {number} height New height of the network
   */
  handleHeightUpdated = (height) => {
    this.props.updateHeight(height);
  }

  render() {
    const renderAuxiliarViews = () => {
      // the auxiliar view needs to be rendered after the other views, or it won't be visible
      // on Android: https://github.com/facebook/react-native/issues/14555
      if (this.props.loadHistory || this.props.lockScreen) {
        return (
          <View style={this.style.auxView}>
            {this.props.lockScreen
              ? <PinScreen isLockScreen navigation={this.props.navigation} />
              : <LoadHistoryScreen />}
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
    <NavigationContainer />
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
