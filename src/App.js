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

import { store, networkError } from './hathorRedux';
import DecideStackScreen from './screens/DecideStackScreen';
import { WelcomeScreen, InitialScreen, NewWordsScreen, LoadWordsScreen } from './screens/InitWallet';
import MainScreen from './screens/MainScreen';
import { SendScreen, SendScreenModal } from './screens/Send';
import { ReceiveScreenModal, ReceiveScreen } from './screens/Receive';
import RegisterToken from './screens/RegisterToken';
import CreateToken from './screens/CreateToken';
import Settings from './screens/Settings';
import TokenDetail from './screens/TokenDetail';
import HathorLogo from './components/HathorLogo';

import hathorLib from '@hathor/wallet-lib';


const InitStack = createStackNavigator(
  {
    WelcomeScreen,
    InitialScreen,
    NewWordsScreen,
    LoadWordsScreen,
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

const TabNavigator = createBottomTabNavigator({
    Home: MainScreen,
    Send: SendScreen,
    Receive: ReceiveScreen,
    Settings: Settings,
  }, {
    initialRoute: 'MainScreen',
    tabBarOptions: {
      activeTintColor: 'white',
      inactiveTintColor: 'rgba(255, 255, 255, 0.6)',
      labelStyle: {
        fontSize: 12,
        marginTop: 4,
      },
      style: {
        backgroundColor: '#0273a0',
        paddingTop: 8,
      },
      tabStyle: {
        justifyContent: 'center'
      },
      showIcon: true
    },
    defaultNavigationOptions: ({ navigation }) => ({
      tabBarIcon: ({ focused, horizontal, tintColor }) => {
        const { routeName } = navigation.state;
        let iconName = null;
        if (routeName === "Home") {
          iconName = faHome;
        } else if (routeName === "Send") {
          iconName = faArrowUp;
        } else if (routeName === "Receive") {
          iconName = faArrowDown;
        } else {
          // settings
          iconName = faCog;
        }
        return <FontAwesomeIcon icon={ iconName } color={ tintColor } size={ 24 } />
      }
    })
});

const AppStack = createStackNavigator({
    Main: TabNavigator,
    SendModal: SendScreenModal,
    ReceiveScreenModal: ReceiveScreenModal,
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
    store.dispatch(networkError(Date.now()));
    return Promise.reject(error);
  });
  return instance;
}
hathorLib.axios.registerNewCreateRequestInstance(createRequestInstance);

export default App;
