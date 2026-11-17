/**
 * Copyright (c) Hathor Labs and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { jest, describe, test, expect, afterEach, beforeEach } from '@jest/globals';

// The real stack navigator: the screens' own tests mock navigation, so they can't see where a
// screen leaves the stack.
jest.unmock('@react-navigation/stack');

// A network the tests give a side chain, and the fake bridge for its quotes.
// eslint-disable-next-line global-require
jest.mock('../../../src/multichain/chains', () => require('../../multichain/fakes/chainsModule'));
// eslint-disable-next-line global-require
jest.mock('../../../src/multichain/bridge', () => require('../../multichain/fakes/bridgeModule'));

// The camera can't run here: the scanner's reader is a stand-in, whose onSuccess the tests call.
jest.mock('../../../src/components/QRCodeReader', () => {
  const QRCodeReaderStandIn = () => null;
  return QRCodeReaderStandIn;
});

/* eslint-disable import/first */
import React from 'react';
import { Alert, Text, TextInput } from 'react-native';
import { act, create } from 'react-test-renderer';
import { Provider } from 'react-redux';
import { legacy_createStore as createStore, applyMiddleware } from 'redux';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { reducer } from '../../../src/reducers/reducer';
import {
  multichainNextCreateTokenUpdate,
  multichainNextSendUpdate,
  multichainTransferUpdate,
  types,
} from '../../../src/actions';
import {
  FEATURE_TOGGLE_DEFAULTS,
  MULTICHAIN_FEATURE_TOGGLE,
  PRE_SETTINGS_TESTNET,
} from '../../../src/constants';
import { STORE } from '../../../src/store';
import NavigationService from '../../../src/NavigationService';
import ChainTransferConfirmScreen from '../../../src/screens/Multichain/ChainTransferConfirmScreen';
import NextCreateTokenConfirmScreen from '../../../src/screens/Multichain/NextCreateTokenConfirmScreen';
import UnifiedQRScanner from '../../../src/screens/UnifiedQRScanner';
import { SendAddressInput } from '../../../src/screens/SendAddressInput';
import QRCodeReader from '../../../src/components/QRCodeReader';
import FeedbackModal from '../../../src/components/FeedbackModal';
import NewHathorButton from '../../../src/components/NewHathorButton';
import { PortalProvider } from '../../../src/components/Portal';
import { NEXT_STATUS, OPERATION_STATUS } from '../../../src/multichain/state';
import { fakePeerAddress } from '../../multichain/fakes/fakeAddress';
import { FAKE_NETWORK } from '../../multichain/fakes/sideChain';
/* eslint-enable import/first */

const OWN_ADDRESS = fakePeerAddress('cd34');

let mounted = null;
let pinCallback = null;

beforeEach(() => {
  jest.spyOn(STORE, 'isPasskeyWallet').mockReturnValue(false);
  pinCallback = null;
  addressStep = SendAddressInputStub;
});

afterEach(async () => {
  if (mounted) {
    await act(async () => { mounted.unmount(); });
    mounted = null;
  }
  jest.restoreAllMocks();
});

function makeStore() {
  const initial = reducer(undefined, { type: '@@INIT' });
  const actions = [];
  const record = () => (nextFn) => (action) => {
    actions.push(action);
    return nextFn(action);
  };
  const store = createStore(reducer, {
    ...initial,
    networkSettings: PRE_SETTINGS_TESTNET,
    featureToggles: { ...FEATURE_TOGGLE_DEFAULTS, [MULTICHAIN_FEATURE_TOGGLE]: true },
    serverInfo: { decimal_places: 2 },
    fullNodeNetworkName: FAKE_NETWORK,
    tokensBalance: { '00': { status: 'ready', data: { available: 125000n } } },
    multichain: {
      ...initial.multichain,
      connectedNetworks: { [FAKE_NETWORK]: true },
      next: { ...initial.multichain.next, status: NEXT_STATUS.READY, address: OWN_ADDRESS },
    },
  }, applyMiddleware(record));
  return { store, actions };
}

// The PIN screen as the app's: it leaves first, then hands the PIN over.
const PinScreenStub = ({ navigation, route }) => {
  pinCallback = (pin) => {
    navigation.goBack();
    route.params.cb(pin);
  };
  return <Text>PIN</Text>;
};
const Home = () => <Text>HOME</Text>;
const SendAddressInputStub = ({ route }) => <Text>{`SEND TO ${route.params?.address ?? ''}`}</Text>;
const SendAmountInputStub = () => <Text>AMOUNT</Text>;
// Send's address step: the stub, or the app's own where a test needs what it keeps typed.
let addressStep = SendAddressInputStub;
const AddressStep = (props) => React.createElement(addressStep, props);

// The app's shape: a root stack whose 'App' holds Main (a navigator of its own, with Home and
// Send, itself a stack) and the screens opened above it. NavigationService.resetToMain resets to
// App > Main > Home.
const SendStack = createStackNavigator();
const Send = () => (
  <SendStack.Navigator screenOptions={{ headerShown: false }}>
    <SendStack.Screen name='SendAddressInput' component={AddressStep} />
    <SendStack.Screen name='SendAmountInput' component={SendAmountInputStub} />
    <SendStack.Screen name='NextSendAmountInput' component={SendAmountInputStub} />
  </SendStack.Navigator>
);
const MainStack = createStackNavigator();
const Main = () => (
  <MainStack.Navigator screenOptions={{ headerShown: false }}>
    <MainStack.Screen name='Home' component={Home} />
    <MainStack.Screen name='Send' component={Send} />
  </MainStack.Navigator>
);
const AppStack = createStackNavigator();
const AppScreens = () => (
  <AppStack.Navigator screenOptions={{ headerShown: false }}>
    <AppStack.Screen name='Main' component={Main} />
    <AppStack.Screen name='ChainTransferConfirm' component={ChainTransferConfirmScreen} />
    <AppStack.Screen name='PinScreen' component={PinScreenStub} />
    <AppStack.Screen name='UnifiedQRScanner' component={UnifiedQRScanner} />
    <AppStack.Screen name='NextCreateTokenConfirm' component={NextCreateTokenConfirmScreen} />
  </AppStack.Navigator>
);
const Root = createStackNavigator();
const navigationRef = React.createRef();

async function mountApp(store) {
  NavigationService.setTopLevelNavigator(navigationRef);
  let renderer;
  await act(async () => {
    renderer = create(
      <Provider store={store}>
        <PortalProvider>
          <NavigationContainer ref={navigationRef}>
            <Root.Navigator screenOptions={{ headerShown: false }}>
              <Root.Screen name='App' component={AppScreens} />
            </Root.Navigator>
          </NavigationContainer>
        </PortalProvider>
      </Provider>,
    );
  });
  mounted = renderer;
  return renderer;
}

// The screens App holds, bottom to top.
const appRoutes = () => {
  const root = navigationRef.current.getRootState();
  return root.routes[root.index].state.routes.map((route) => route.name);
};
// The screens Send holds, bottom to top.
const sendRoutes = () => {
  const root = navigationRef.current.getRootState();
  const app = root.routes[root.index].state;
  const main = app.routes.find((route) => route.name === 'Main').state;
  return main.routes.find((route) => route.name === 'Send').state.routes.map((route) => route.name);
};
const buttons = (renderer, title) => renderer.root.findAllByType(NewHathorButton)
  .filter((node) => node.props.title === title);

describe('leaving a transfer', () => {
  test('Done goes back to the Dashboard and closes the confirm screen', async () => {
    const { store, actions } = makeStore();
    const renderer = await mountApp(store);
    await act(async () => {
      navigationRef.current.navigate('App', {
        screen: 'ChainTransferConfirm',
        params: {
          from: 'hathor', to: 'hathor-next', tokenId: '00', amount: '10000', toAddress: OWN_ADDRESS,
        },
      });
    });
    expect(appRoutes()).toEqual(['Main', 'ChainTransferConfirm']);
    await act(async () => { buttons(renderer, 'Confirm and send')[0].props.onPress(); });
    await act(async () => { pinCallback('123456'); });
    // The outcome of this screen's own request.
    const { requestId } = actions
      .find((a) => a.type === types.MULTICHAIN_TRANSFER_REQUESTED).payload;
    await act(async () => {
      store.dispatch(multichainTransferUpdate({ status: OPERATION_STATUS.DONE, requestId }));
    });
    const [done] = renderer.root.findAllByType(FeedbackModal);
    await act(async () => { done.props.action.props.onPress(); });

    // One Main, and no confirm screen left under it to come back to with its Confirm on (in the
    // test the leaving screen's card stays drawn: its closing transition never ends here).
    expect(appRoutes()).toEqual(['Main']);
    const requests = actions.filter((a) => a.type === types.MULTICHAIN_TRANSFER_REQUESTED);
    expect(requests).toHaveLength(1);
  });
});

describe('leaving a transfer not confirmed yet', () => {
  test('Close leaves, and its message with it', async () => {
    const { store } = makeStore();
    const renderer = await mountApp(store);
    await act(async () => {
      navigationRef.current.navigate('App', {
        screen: 'ChainTransferConfirm',
        params: {
          from: 'hathor', to: 'hathor-next', tokenId: '00', amount: '10000', toAddress: OWN_ADDRESS,
        },
      });
    });
    await act(async () => {
      store.dispatch(multichainTransferUpdate({ status: OPERATION_STATUS.UNCONFIRMED }));
    });
    const [unconfirmed] = renderer.root.findAllByType(FeedbackModal);
    await act(async () => { unconfirmed.props.action.props.onPress(); });
    expect(appRoutes()).toEqual(['Main']);
  });
});

describe('a Hathor Next address scanned from the Dashboard', () => {
  test('opens Send on the Main already there, with the scanner gone', async () => {
    const { store } = makeStore();
    const renderer = await mountApp(store);
    await act(async () => { navigationRef.current.navigate('App', { screen: 'UnifiedQRScanner' }); });
    expect(appRoutes()).toEqual(['Main', 'UnifiedQRScanner']);
    const reader = renderer.root.findByType(QRCodeReader);
    await act(async () => { reader.props.onSuccess({ data: OWN_ADDRESS }); });
    expect(appRoutes()).toEqual(['Main']);
    const texts = renderer.root.findAllByType(Text).map((node) => node.props.children);
    expect(texts).toContain(`SEND TO ${OWN_ADDRESS}`);
  });

  test('over a Send left half way, goes back to its address step instead of adding one', async () => {
    const { store } = makeStore();
    const renderer = await mountApp(store);
    await act(async () => {
      navigationRef.current.navigate('App', {
        screen: 'Main',
        params: { screen: 'Send', params: { screen: 'SendAddressInput', params: { address: 'x' } } },
      });
    });
    await act(async () => {
      navigationRef.current.navigate('App', {
        screen: 'Main',
        params: { screen: 'Send', params: { screen: 'SendAmountInput' } },
      });
    });
    expect(sendRoutes()).toEqual(['SendAddressInput', 'SendAmountInput']);
    await act(async () => { navigationRef.current.navigate('App', { screen: 'UnifiedQRScanner' }); });
    const reader = renderer.root.findByType(QRCodeReader);
    await act(async () => { reader.props.onSuccess({ data: OWN_ADDRESS }); });
    expect(appRoutes()).toEqual(['Main']);
    expect(sendRoutes()).toEqual(['SendAddressInput']);
    const texts = renderer.root.findAllByType(Text).map((node) => node.props.children);
    expect(texts).toContain(`SEND TO ${OWN_ADDRESS}`);
  });

  test('a second scan of the same address fills it in again over what the user typed', async () => {
    addressStep = SendAddressInput;
    const OTHER_ADDRESS = fakePeerAddress('ab12');
    const { store } = makeStore();
    const renderer = await mountApp(store);
    const field = () => renderer.root.findByType(TextInput);
    const scan = async (data) => {
      await act(async () => { navigationRef.current.navigate('App', { screen: 'UnifiedQRScanner' }); });
      const reader = renderer.root.findByType(QRCodeReader);
      await act(async () => { reader.props.onSuccess({ data }); });
    };
    await scan(OWN_ADDRESS);
    expect(field().props.value).toBe(OWN_ADDRESS);
    // The user pays another address instead, and goes on to its amount.
    await act(async () => { field().props.onChangeText(OTHER_ADDRESS); });
    await act(async () => { buttons(renderer, 'Next')[0].props.onPress(); });
    expect(sendRoutes()).toEqual(['SendAddressInput', 'NextSendAmountInput']);

    await scan(OWN_ADDRESS);
    expect(sendRoutes()).toEqual(['SendAddressInput']);
    // The address scanned, not the one typed before: Next would pay that one.
    expect(field().props.value).toBe(OWN_ADDRESS);
  });

  test('waits while a payment is on its way, rather than close the screen that holds it', async () => {
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    const { store } = makeStore();
    const renderer = await mountApp(store);
    await act(async () => {
      navigationRef.current.navigate('App', {
        screen: 'Main',
        params: { screen: 'Send', params: { screen: 'SendAddressInput', params: { address: 'x' } } },
      });
    });
    await act(async () => {
      navigationRef.current.navigate('App', {
        screen: 'Main',
        params: { screen: 'Send', params: { screen: 'NextSendAmountInput' } },
      });
    });
    await act(async () => {
      store.dispatch(multichainNextSendUpdate({ status: 'pending', draftId: 'payment-1' }));
    });
    await act(async () => { navigationRef.current.navigate('App', { screen: 'UnifiedQRScanner' }); });
    const reader = renderer.root.findByType(QRCodeReader);
    await act(async () => { reader.props.onSuccess({ data: OWN_ADDRESS }); });
    expect(alert).toHaveBeenCalledWith('Payment on its way', expect.any(String), expect.anything());
    // Send keeps its screens, the one that shows the payment's outcome among them.
    expect(sendRoutes()).toEqual(['SendAddressInput', 'NextSendAmountInput']);
  });
});

describe('leaving a token creation', () => {
  test('Done goes back to the Dashboard and closes the confirm screen', async () => {
    const { store, actions } = makeStore();
    const renderer = await mountApp(store);
    await act(async () => {
      navigationRef.current.navigate('App', {
        screen: 'NextCreateTokenConfirm',
        params: { name: 'App Test Token', symbol: 'ATT', amount: '100000000' },
      });
    });
    expect(appRoutes()).toEqual(['Main', 'NextCreateTokenConfirm']);
    await act(async () => { buttons(renderer, 'Create token')[0].props.onPress(); });
    await act(async () => { pinCallback('123456'); });
    const [request] = actions
      .filter((a) => a.type === types.MULTICHAIN_NEXT_CREATE_TOKEN_REQUESTED);
    await act(async () => {
      store.dispatch(multichainNextCreateTokenUpdate({
        status: OPERATION_STATUS.RECORDED, draftId: request.payload.draftId,
      }));
    });
    const [done] = renderer.root.findAllByType(FeedbackModal);
    await act(async () => { done.props.action.props.onPress(); });
    // One Main, and no confirm screen left under it to create the token again.
    expect(appRoutes()).toEqual(['Main']);
  });
});
