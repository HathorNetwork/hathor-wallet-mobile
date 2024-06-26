/**
 * Copyright (c) Hathor Labs and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import 'react-native-gesture-handler';
import '../shim';

import React, { useEffect, useState } from 'react';
import { AppState, StyleSheet, View } from 'react-native';
import { connect, Provider, useDispatch, useSelector } from 'react-redux';
import * as Keychain from 'react-native-keychain';
import DeviceInfo from 'react-native-device-info';
import notifee, { EventType } from '@notifee/react-native';

import hathorLib from '@hathor/wallet-lib';

import { createStackNavigator } from '@react-navigation/stack';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import {
  getFocusedRouteNameFromRoute,
  NavigationContainer,
  useRoute
} from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import IconTabBar from './icon-font';
import { IS_MULTI_TOKEN, LOCK_TIMEOUT, PUSH_ACTION, INITIAL_TOKENS } from './constants';
import { setSupportedBiometry } from './utils';
import {
  lockScreen,
  onExceptionCaptured,
  pushTxDetailsRequested,
  requestCameraPermission,
  resetData,
  setTokens,
} from './actions';
import { store } from './reducers/reducer.init';
import { GlobalErrorHandler } from './components/GlobalErrorModal';
import {
  InitialScreen,
  LoadWordsScreen,
  NewWordsScreen,
  WelcomeScreen,
} from './screens/InitWallet';
import ChoosePinScreen from './screens/ChoosePinScreen';
import BackupWords from './screens/BackupWords';
import PinScreen from './screens/PinScreen';
import ResetWallet from './screens/ResetWallet';
import LoadHistoryScreen from './screens/LoadHistoryScreen';
import LoadWalletErrorScreen from './screens/LoadWalletErrorScreen';
import { WALLET_STATUS } from './sagas/wallet';

import { STORE } from './store';
import NavigationService from './NavigationService';
import MainScreen from './screens/MainScreen';
import SendScanQRCode from './screens/SendScanQRCode';
import SendAddressInput from './screens/SendAddressInput';
import SendAmountInput from './screens/SendAmountInput';
import SendConfirmScreen from './screens/SendConfirmScreen';
import Dashboard from './screens/Dashboard';
import RegisterToken from './screens/RegisterToken';
import CreateTokenDepositNotice from './screens/CreateTokenDepositNotice';
import CreateTokenAmount from './screens/CreateTokenAmount';
import CreateTokenConfirm from './screens/CreateTokenConfirm';
import CreateTokenDetail from './screens/CreateTokenDetail';
import RegisterTokenManual from './screens/RegisterTokenManual';
import CreateTokenName from './screens/CreateTokenName';
import CreateTokenSymbol from './screens/CreateTokenSymbol';
import About from './screens/About';
import Security from './screens/Security';
import PushNotification from './screens/PushNotification';
import ChangePin from './screens/ChangePin';
import PaymentRequestDetail from './screens/PaymentRequestDetail';
import ChangeToken from './screens/ChangeToken';
import TokenDetail from './screens/TokenDetail';
import UnregisterToken from './screens/UnregisterToken';
import ReceiveScreen from './screens/Receive';
import Settings from './screens/Settings';
import WalletConnectList from './screens/WalletConnect/WalletConnectList';
import WalletConnectManual from './screens/WalletConnect/WalletConnectManual';
import WalletConnectScan from './screens/WalletConnect/WalletConnectScan';
import baseStyle from './styles/init';
import WalletConnectModal from './components/WalletConnect/WalletConnectModal';
import { COLORS, HathorTheme } from './styles/themes';
import { NetworkSettingsFlowNav, NetworkSettingsFlowStack } from './screens/NetworkSettings';
import { NetworkStatusBar } from './components/NetworkSettings/NetworkStatusBar';
import { NanoContractDetailsScreen } from './screens/NanoContract/NanoContractDetailsScreen';
import { NanoContractTransactionScreen } from './screens/NanoContract/NanoContractTransactionScreen';
import { NanoContractRegisterScreen } from './screens/NanoContract/NanoContractRegisterScreen';
import { NewNanoContractTransactionScreen } from './screens/WalletConnect/NewNanoContractTransactionScreen';
import { NewNanoContractTransactionModal } from './components/WalletConnect/NanoContract/NewNanoContractTransactionModal';

/**
 * This Stack Navigator is exhibited when there is no wallet initialized on the local storage.
 */
const InitStack = () => {
  const Stack = createStackNavigator();
  return (
    <SafeAreaView
      edges={['bottom']}
      style={{ flex: 1, backgroundColor: baseStyle.container.backgroundColor }}
    >
      <Stack.Navigator
        initialRouteName='Welcome'
        screenOptions={{
          headerShown: false,
        }}
      >
        <Stack.Screen name='WelcomeScreen' component={WelcomeScreen} />
        <Stack.Screen name='InitialScreen' component={InitialScreen} />
        <Stack.Screen name='NewWordsScreen' component={NewWordsScreen} />
        <Stack.Screen name='LoadWordsScreen' component={LoadWordsScreen} />
        <Stack.Screen name='BackupWords' component={BackupWords} />
        <Stack.Screen name='ChoosePinScreen' component={ChoosePinScreen} />
      </Stack.Navigator>
    </SafeAreaView>
  );
};

/**
 * The Dashboard navigator contains the Token Select screen ( if the wallet has multiple tokens )
 * and the Token Details screen.
 */
const DashboardStack = () => {
  const Stack = createStackNavigator();

  return (
    <Stack.Navigator
      initialRouteName='Dashboard'
      screenOptions={{
        headerShown: false,
      }}
    >
      <Stack.Screen name='Dashboard' component={Dashboard} />
      <Stack.Screen name='MainScreen' component={MainScreen} />
    </Stack.Navigator>
  );
};

/**
 * This blank screen serves as a way to request the user permission to use the camera without
 * rendering anything on the main interface for a potentially very short time.
 * A listener should be set to the `isCameraAvailable` state variable to decide what to render after
 * the permission is defined.
 */
const CameraPermissionScreen = () => null;

/**
 * Stack of screens dedicated to the token sending process
 */
const SendStack = ({ navigation }) => {
  const Stack = createStackNavigator();
  const [initialRoute, setInitialRoute] = useState('CameraPermissionScreen');
  const isCameraAvailable = useSelector((state) => state.isCameraAvailable);
  const dispatch = useDispatch();

  /*
   * Request camera permission on initialization, if permission is not already set
   */
  useEffect(() => {
    if (isCameraAvailable === null) {
      dispatch(requestCameraPermission());
    }
  }, []);

  // Listen to camera permission changes from user input and navigate to the relevant screen
  useEffect(() => {
    let initScreenName;
    switch (isCameraAvailable) {
      case true:
        initScreenName = 'SendScanQRCode';
        break;
      case false:
        initScreenName = 'SendAddressInput';
        break;
      default:
        initScreenName = 'CameraPermissionScreen';
    }
    setInitialRoute(initScreenName);
    navigation.replace(initScreenName);
  }, [isCameraAvailable]);

  return (
    <Stack.Navigator
      initialRouteName={initialRoute}
      screenOptions={{
        headerShown: false,
      }}
    >
      <Stack.Screen name='CameraPermissionScreen' component={CameraPermissionScreen} />
      <Stack.Screen name='SendScanQRCode' component={SendScanQRCode} />
      <Stack.Screen name='SendAddressInput' component={SendAddressInput} />
      <Stack.Screen name='SendAmountInput' component={SendAmountInput} />
      <Stack.Screen name='SendConfirmScreen' component={SendConfirmScreen} />
    </Stack.Navigator>
  );
};

/**
 * Stack of screens dedicated to the token creation process
 */
const CreateTokenStack = () => {
  const Stack = createStackNavigator();

  return (
    <Stack.Navigator
      initialRouteName='CreateTokenDepositNotice'
      screenOptions={{
        headerShown: false,
      }}
    >
      <Stack.Screen name='CreateTokenDepositNotice' component={CreateTokenDepositNotice} />
      <Stack.Screen name='CreateTokenName' component={CreateTokenName} />
      <Stack.Screen name='CreateTokenSymbol' component={CreateTokenSymbol} />
      <Stack.Screen name='CreateTokenAmount' component={CreateTokenAmount} />
      <Stack.Screen name='CreateTokenConfirm' component={CreateTokenConfirm} />
      <Stack.Screen name='CreateTokenDetail' component={CreateTokenDetail} />
    </Stack.Navigator>
  );
};

/**
 * Stack of screens dedicated to the token registration process
 */
const RegisterTokenStack = ({ navigation }) => {
  const Stack = createStackNavigator();
  const dispatch = useDispatch();
  const isCameraAvailable = useSelector((state) => state.isCameraAvailable);

  /**
   * Defines which screen will be the initial one, according to app camera permissions
   * @param {null|boolean} cameraStatus
   * @returns {string} Route name
   */
  const decideRouteByCameraAvailablity = (cameraStatus) => {
    switch (isCameraAvailable) {
      case true:
        return 'RegisterTokenScreen';
      case false:
        return 'RegisterTokenManual';
      default:
        return 'RegisterCameraPermissionScreen';
    }
  };

  // Initial screen set on component initial rendering
  const [initialRoute, setInitialRoute] = useState(
    decideRouteByCameraAvailablity(isCameraAvailable)
  );

  /*
   * Request camera permission on initialization only if permission is not already set
   */
  useEffect(() => {
    if (isCameraAvailable === null) {
      dispatch(requestCameraPermission());
    }
  }, []);

  // Listen to camera permission changes from user input and navigate to the relevant screen
  useEffect(() => {
    const newScreenName = decideRouteByCameraAvailablity(isCameraAvailable);

    // Navigator screen already correct: no further action.
    if (initialRoute === newScreenName) {
      return;
    }

    // Set initial route and navigate there according to new permission set
    setInitialRoute(newScreenName);
    navigation.replace(newScreenName);
  }, [isCameraAvailable]);

  return (
    <Stack.Navigator
      initialRouteName={initialRoute}
      screenOptions={{
        headerShown: false,
      }}
    >
      <Stack.Screen name='RegisterCameraPermissionScreen' component={CameraPermissionScreen} />
      <Stack.Screen name='RegisterTokenScreen' component={RegisterToken} />
      <Stack.Screen name='RegisterTokenManual' component={RegisterTokenManual} />
    </Stack.Navigator>
  );
};

const tabBarIconMap = {
  Home: 'icDashboard',
  Send: 'icSend',
  Receive: 'icReceive',
  Settings: 'icSettings',
};

/**
 * Visible navigator to the user, with a bottom tab selector containing:
 * - Dashboard
 * - Send Tokens
 * - Receive Tokens
 * - Settings
 */
const TabNavigator = () => {
  const Tab = createBottomTabNavigator();

  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        tabBarIcon: ({ focused }) => {
          const { name } = route;
          const iconName = tabBarIconMap[name];
          const colorName = focused ? COLORS.primary : COLORS.textColorShadow;
          return (<IconTabBar name={iconName} size={24} color={colorName} />);
        },
        tabBarStyle: {
          paddingTop: 12,
          paddingBottom: 12,
        },
        tabBarItemStyle: {
          justifyContent: 'center',
        },
        tabBarShowLabel: false,
        headerShown: false,
      })}
    >
      <Tab.Screen
        name='Home'
        component={IS_MULTI_TOKEN ? DashboardStack : MainScreen}
      />
      <Tab.Screen name='Send' component={SendStack} />
      <Tab.Screen name='Receive' component={ReceiveScreen} />
      <Tab.Screen name='Settings' component={Settings} />
    </Tab.Navigator>
  );
};

/**
 * Navigator containing all screens for the loaded wallet
 */
const AppStack = () => {
  const Stack = createStackNavigator();
  const [edges, setEdges] = useState([]);
  const route = useRoute();

  /*
   * On iOS there are some screens that are not displayed within the "BottomTabBar" context AND have
   * an interaction element on the bottom of the visible area. When these two conditions happen, it
   * is more visually comfortable to add a bottom safe area, using the `SafeAreaView` inset
   * parameters.
   */
  useEffect(() => {
    const lastRouteName = getFocusedRouteNameFromRoute(route);
    let newEdges;
    switch (lastRouteName) {
      case 'RegisterToken':
      case 'PaymentRequestDetail':
      case 'CreateTokenStack':
      case 'About':
      case 'ResetWallet':
        newEdges = ['bottom'];
        break;
      default:
        newEdges = [];
    }
    setEdges(newEdges);
  }, [route]);

  return (
    <SafeAreaView
      edges={edges}
      style={{ flex: 1, backgroundColor: baseStyle.container.backgroundColor }}
    >
      <Stack.Navigator
        screenOptions={{
          headerShown: false,
        }}
      >
        <Stack.Screen
          name='Main'
          initialParams={{ hName: 'Main' }}
          component={TabNavigator}
        />
        <Stack.Screen name='NanoContractDetailsScreen' component={NanoContractDetailsScreen} />
        <Stack.Screen name='NanoContractTransactionScreen' component={NanoContractTransactionScreen} />
        <Stack.Screen name='NanoContractRegisterScreen' component={NanoContractRegisterScreen} />
        <Stack.Screen name='About' component={About} />
        <Stack.Screen name='Security' component={Security} />
        <Stack.Screen name='WalletConnectList' component={WalletConnectList} />
        <Stack.Screen name='WalletConnectManual' component={WalletConnectManual} />
        <Stack.Screen name='WalletConnectScan' component={WalletConnectScan} />
        <Stack.Screen name='NewNanoContractTransactionScreen' component={NewNanoContractTransactionScreen} />
        <Stack.Screen name='PushNotification' component={PushNotification} />
        <Stack.Screen name='ChangePin' component={ChangePin} />
        <Stack.Screen
          name='ResetWallet'
          component={ResetWallet}
          options={{ gesturesEnabled: false }}
        />
        <Stack.Screen name='PaymentRequestDetail' component={PaymentRequestDetail} />
        <Stack.Screen name='RegisterToken' component={RegisterTokenStack} />
        <Stack.Screen name='ChangeToken' component={ChangeToken} />
        <Stack.Screen name={NetworkSettingsFlowNav} component={NetworkSettingsFlowStack} />
        <Stack.Screen
          name='PinScreen'
          component={PinScreen}
          options={{ gesturesEnabled: false }}
        />
        <Stack.Screen name='CreateTokenStack' component={CreateTokenStack} />
        <Stack.Screen name='TokenDetail' component={TokenDetail} />
        <Stack.Screen name='UnregisterToken' component={UnregisterToken} />
      </Stack.Navigator>
    </SafeAreaView>
  );
};

/**
 * loadHistory {bool} Indicates we're loading the tx history
 * lockScreen {bool} Indicates screen is locked
 */
const mapStateToProps = (state) => ({
  loadHistory: state.loadHistoryStatus.active,
  isScreenLocked: state.lockScreen,
  isResetOnScreenLocked: state.resetOnLockScreen,
  walletStartState: state.walletStartState,
  wallet: state.wallet,
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
      backgroundColor: baseStyle.container.backgroundColor,
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
        const isPressAction = (pressType) => (
          pressType === EventType.ACTION_PRESS || pressType === EventType.PRESS);
        switch (true) {
          case isPressAction(type):
            try {
              if (detail.pressAction?.id === PUSH_ACTION.NEW_TRANSACTION
                  || detail.pressAction?.id === 'default') {
                console.debug('Notification pressed or action pressed on foreground.');
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
      this.props.captureError(error);
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
    if (this.props.wallet?.storage) {
      this.props.wallet.storage.config.setUserAgent(`Hathor Wallet Mobile / ${version}`);
    }
    // set notification foreground listener
    this.setNotifeeForegroundListener();
  }

  componentWillUnmount = () => {
    if (this.appStateChangeEventSub) {
      this.appStateChangeEventSub.remove();
      this.appStateChangeEventSub = null;
    }
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
   * These tokens are known as 'registered' tokens
   */
  updateReduxTokens = async () => {
    if (!this.props.wallet?.storage) {
      return;
    }
    const tokens = { ...INITIAL_TOKENS };
    const iterator = this.props.wallet.storage.getRegisteredTokens();
    let next = await iterator.next();
    // XXX: The "for await" syntax wouldbe better but this is failing due to
    // redux-saga messing with the for operator runtime
    while (!next.done) {
      const token = next.value;
      // We need to filter the token data to remove the metadata from this list (e.g. balance)
      tokens[token.uid] = { ...token };
      // eslint-disable-next-line no-await-in-loop
      next = await iterator.next();
    }
    this.props.setTokens(tokens);
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

      if (this.props.isScreenLocked) {
        /**
         * NOTE:
         * This approach shows the ResetWallet screen as an auxiliar view,
         * replacing the PinScreen and setting the back button to drop the view,
         * letting the PinScreen be re-rendered.
         *
         * This approach also keeps the navigation stack unchanged,
         * therefore increasing the convinience for the user.
         */
        if (this.props.isResetOnScreenLocked) {
          screen = <ResetWallet navigation={this.props.navigation} />;
        } else {
          screen = <PinScreen isLockScreen navigation={this.props.navigation} />;
        }
      } else {
        screen = <LoadHistoryScreen />;
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

const BlankScreen = () => null;

/**
 * This is the main Navigator, evaluating if the wallet is already loaded and navigating to the
 * relevant screen.
 */
const RootStack = () => {
  const dispatch = useDispatch();
  const [appStatus, setAppStatus] = useState('initializing');

  useEffect(() => {
    STORE.preStart()
      .then(() => STORE.walletIsLoaded())
      .then((_isLoaded) => {
        setAppStatus(_isLoaded ? 'isLoaded' : 'notLoaded');
      })
      .catch((e) => {
        // The promise here is swallowing the error,
        // so we need to explicitly catch here.
        //
        // If we have a fail here, the wallet will
        // show up as if it was the first time it was
        // opened, so we need to capture and display
        // an error to give a chance for the user
        // to recover his loaded wallet.
        console.error(e);
        dispatch(onExceptionCaptured(e, true));
      });
  }, []);

  useEffect(() => {
    // If the wallet is loaded, navigate to the main screen with no option to return to init
    switch (appStatus) {
      case 'isLoaded':
        NavigationService.resetToMain();
        break;
      case 'notLoaded':
        navigationRef.current.reset({
          index: 0,
          routes: [{ name: 'Init' }],
        });
        break;
      default:
        // Do not navigate anywhere if the storage has not returned the isLoaded data
    }
  }, [appStatus]);

  const Stack = createStackNavigator();

  /*
   * XXX: Screens within the Root Stack have no transition animation, as they are processed before
   * any user interface.
   */
  return (
    <Stack.Navigator
      initialRouteName='Decide'
      screenOptions={{
        headerShown: false,
        gestureEnabled: false,
        animationEnabled: false,
      }}
    >
      <Stack.Screen name='Decide' component={BlankScreen} />
      <Stack.Screen name='App' component={AppStackWrapper} />
      <Stack.Screen name='Init' component={InitStack} />
    </Stack.Navigator>
  );
};

const navigationRef = React.createRef();
NavigationService.setTopLevelNavigator(navigationRef);

const App = () => (
  <SafeAreaProvider>
    <Provider store={store}>
      <SafeAreaView
        edges={['top', 'right', 'left']}
        style={{ flex: 1, backgroundColor: COLORS.backgroundColor }}
      >
        <NavigationContainer
          theme={HathorTheme}
          ref={navigationRef}
        >
          <NetworkStatusBar />
          <RootStack />
          <NewNanoContractTransactionModal />
        </NavigationContainer>
        <WalletConnectModal />
        <GlobalErrorHandler />
      </SafeAreaView>
    </Provider>
  </SafeAreaProvider>
);

// custom interceptor for axios
const createRequestInstance = (resolve, timeout) => {
  const instance = hathorLib.axios.defaultCreateRequestInstance(resolve, timeout);

  instance.interceptors.response.use((response) => response, (error) => Promise.reject(error));
  return instance;
};
hathorLib.axios.registerNewCreateRequestInstance(createRequestInstance);

export default App;
