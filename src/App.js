/**
 * Sample React Native App
 * https://github.com/facebook/react-native
 *
 * @format
 * @flow
 */

import '../shim.js'

import React from 'react';
import { Platform } from 'react-native';
import { createBottomTabNavigator, createStackNavigator, createSwitchNavigator, createAppContainer } from 'react-navigation';
import { Provider } from 'react-redux';

import { FontAwesomeIcon } from '@fortawesome/react-native-fontawesome'
import { faArrowDown, faArrowUp, faCog, faHome } from '@fortawesome/free-solid-svg-icons'

import { store } from './reducer';
import DecideStackScreen from './screens/DecideStackScreen';
import { WelcomeScreen, InitialScreen, NewWordsScreen, LoadWordsScreen } from './screens/InitWallet';
import ChoosePinScreen from './screens/ChoosePinScreen';
import MainScreen from './screens/MainScreen';
import { SendScreen, SendScreenModal } from './screens/Send';
import ReceiveScreen from './screens/Receive';
import PaymentRequestDetail from './screens/PaymentRequestDetail';
import RegisterToken from './screens/RegisterToken';
import CreateToken from './screens/CreateToken';
import Settings from './screens/Settings';
import TokenDetail from './screens/TokenDetail';
import HathorLogo from './components/HathorLogo';
import { PinScreen } from './screens/PinScreen';

import hathorLib from '@hathor/wallet-lib';


const InitStack = createStackNavigator(
  {
    WelcomeScreen,
    InitialScreen,
    NewWordsScreen,
    LoadWordsScreen,
    ChoosePinScreen,
  },
  {
    initialRouteName: 'WelcomeScreen',
    defaultNavigationOptions: {
      headerTintColor: '#0273a0',
      headerTitle: <HathorLogo />,
      headerTitleContainerStyle: {
        marginLeft: Platform.OS === 'ios' ? 0 : -56, // In android when you have the navigation with a back button the title is moved to the right
      },
    }
  }
);

const TabBarIconsMap = {
  'Home': faHome,
  'Send': faArrowUp,
  'Receive': faArrowDown,
  'Settings': faCog,
};

const TabNavigator = createBottomTabNavigator({
  Home: MainScreen,
    Send: SendScreen,
    Receive: ReceiveScreen,
    Settings: Settings,
  }, {
    initialRoute: 'MainScreen',
    tabBarOptions: {
      activeTintColor: '#E30052',
      inactiveTintColor: '#333333',
      style: {
        paddingTop: 12,
        paddingBottom: 12,
      },
      tabStyle: {
        justifyContent: 'center'
      },
      showIcon: true,
      showLabel: false,
    },
    defaultNavigationOptions: ({ navigation }) => ({
      tabBarIcon: ({ focused, horizontal, tintColor }) => {
        const { routeName } = navigation.state;
        const iconName = TabBarIconsMap[routeName];
        return <FontAwesomeIcon icon={ iconName } color={ tintColor } size={ 24 } />
      }
    })
});

const AppStack = createStackNavigator({
    Main: TabNavigator,
    SendModal: SendScreenModal,
    PaymentRequestDetail,
    PinScreen: {
      screen: PinScreen,
      // disable swipe down dismissal on lock screen
      navigationOptions: () => ({
        gesturesEnabled: false, 
      }),
    },
    RegisterToken,
    CreateToken,
    TokenDetail,
  }, {
    mode: 'modal',
    headerMode: 'none',
});

const SwitchNavigator = createSwitchNavigator({
    Decide: DecideStackScreen,
    App: AppStack,
    Init: InitStack,
  }, {
    initialRouteName: 'Decide',
});

const NavigationContainer = createAppContainer(SwitchNavigator);

const App = () => (
  <Provider store={store}>
    <NavigationContainer />
  </Provider>
)

// custom interceptor for axios
const createRequestInstance = (resolve, timeout) => {
  const instance = hathorLib.axios.defaultCreateRequestInstance(resolve, timeout);

  instance.interceptors.response.use((response) => {
    return response;
  }, (error) => {
    // Adding conditional because if the server forgets to send back the CORS
    // headers, error.response will be undefined
    return Promise.reject(error);
  });
  return instance;
}
hathorLib.axios.registerNewCreateRequestInstance(createRequestInstance);

export default App;
