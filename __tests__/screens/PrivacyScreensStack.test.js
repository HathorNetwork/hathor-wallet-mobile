/**
 * Copyright (c) Hathor Labs and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { jest, describe, test, expect, afterEach } from '@jest/globals';
import React from 'react';
import { act, create } from 'react-test-renderer';
import { Provider } from 'react-redux';
import { legacy_createStore as createStore } from 'redux';
import {
  NavigationContainer,
  StackRouter,
  createNavigationContainerRef,
  createNavigatorFactory,
  useNavigationBuilder,
} from '@react-navigation/native';
import { reducer } from '../../src/reducers/reducer';
import {
  networkSettingsUpdateState,
  setFeatureToggles,
  setFullNodeNetworkName,
  setServerInfo,
  setWallet,
  shieldedCapabilityUpdate,
  shieldedProviderUpdate,
  startWalletRequested,
  unlockScreen,
} from '../../src/actions';
import {
  FEATURE_TOGGLE_DEFAULTS,
  FULL_NETWORK_SHIELDED_TESTNET,
  PRE_SETTINGS_SHIELDED_TESTNET,
  SHIELDED_OUTPUTS_FEATURE_TOGGLE,
  SHIELDED_PROVIDER_STATUS,
} from '../../src/constants';
import { PortalProvider } from '../../src/components/Portal';
import PrivacySettings from '../../src/screens/PrivacySettings';
import ExportPrivacyKeys from '../../src/screens/ExportPrivacyKeys';

const PIN = '135790';
const SCAN_XPRIV = 'xprv9zyUunmbsdp4RhWSTQD3Dub6p2wBJHqbFXuW9HbPMyGgM3iUWh5PpuFWFp3b2ybA2T61D9aw6xA2EoN7BVq6oG6wkxzURSGVNvqo7nKpx6H';
const SCAN_MASKED = 'xprv9zyUunmb…o7nKpx6H';

const capability = (level) => ({
  level,
  reason: level === 'full' ? null : 'locked',
  cause: level === 'full' ? null : 'wrong-pin',
  canReceive: level === 'full',
  canSpend: level === 'full',
  historyComplete: true,
  undecoded: { txIds: [], locked: 0, unreadable: 0, error: 0 },
});

/**
 * A stack navigator on React Navigation's StackRouter that renders every route of its stack, as
 * the app's stack keeps the screens under the top one mounted. The app's own stack navigator is
 * mocked in the tests.
 */
function AllRoutesStack({
  id,
  initialRouteName,
  children,
  screenOptions,
}) {
  const { state, descriptors, NavigationContent } = useNavigationBuilder(StackRouter, {
    id,
    initialRouteName,
    children,
    screenOptions,
  });
  return (
    <NavigationContent>
      {state.routes.map((route) => (
        <React.Fragment key={route.key}>{descriptors[route.key].render()}</React.Fragment>
      ))}
    </NavigationContent>
  );
}

const Stack = createNavigatorFactory(AllRoutesStack)();

// The tabs, Settings among them, that the privacy settings open from.
const MainStandIn = () => null;
// The PIN screen: the tests read its params from its route, and act as it does.
const PinScreenStandIn = () => null;

let mounted = null;

afterEach(async () => {
  if (mounted) {
    await act(async () => { mounted.unmount(); });
    mounted = null;
  }
  jest.restoreAllMocks();
});

/**
 * Renders the app's stack with the tabs at its bottom, the privacy screens and the PIN screen,
 * for a seed wallet on the shielded testnet with a ready provider, at a capability level, with
 * the flag on unless `flag` is false.
 */
async function render({ flag = true, level = 'full' } = {}) {
  const store = createStore(reducer);
  store.dispatch(networkSettingsUpdateState(PRE_SETTINGS_SHIELDED_TESTNET));
  store.dispatch(setServerInfo({ decimal_places: 2, native_token: { name: 'Hathor', symbol: 'HTR' } }));
  store.dispatch(setFeatureToggles({
    ...FEATURE_TOGGLE_DEFAULTS,
    [SHIELDED_OUTPUTS_FEATURE_TOGGLE]: flag,
  }));
  store.dispatch(setFullNodeNetworkName(FULL_NETWORK_SHIELDED_TESTNET));
  store.dispatch(shieldedProviderUpdate({ status: SHIELDED_PROVIDER_STATUS.READY }));
  store.dispatch(shieldedCapabilityUpdate(capability(level)));
  store.dispatch(setWallet({
    getShieldedCapability: jest.fn(async () => capability('full')),
    storage: {
      getSpendXPubKey: jest.fn(async () => 'xpub-stand-in-for-the-spend-key'),
      getScanXPrivKey: jest.fn(async () => SCAN_XPRIV),
    },
  }));
  store.dispatch(unlockScreen());

  const navigationRef = createNavigationContainerRef();
  let renderer;
  await act(async () => {
    renderer = create(
      <Provider store={store}>
        <PortalProvider>
          <NavigationContainer ref={navigationRef}>
            <Stack.Navigator>
              <Stack.Screen name='Main' component={MainStandIn} />
              <Stack.Screen name='PrivacySettings' component={PrivacySettings} />
              <Stack.Screen name='ExportPrivacyKeys' component={ExportPrivacyKeys} />
              <Stack.Screen name='PinScreen' component={PinScreenStandIn} />
            </Stack.Navigator>
          </NavigationContainer>
        </PortalProvider>
      </Provider>,
    );
  });
  mounted = renderer;

  const routes = () => navigationRef.getRootState().routes.map((route) => route.name);
  const open = (name) => act(async () => { navigationRef.navigate(name); });
  const texts = () => renderer.root
    .findAll((node) => node.type === 'Text')
    .map((node) => [].concat(node.props.children).join(''));
  const press = (title) => act(async () => {
    renderer.root.findAll(
      (node) => node.props.title === title && typeof node.props.onPress === 'function',
    )[0].props.onPress();
  });
  /** Opens the privacy settings, then the export, from the tabs. */
  const openExport = async () => {
    await open('PrivacySettings');
    await open('ExportPrivacyKeys');
  };
  /** Closes the PIN screen on top, as its Cancel and Android's back do. */
  const cancelPin = () => act(async () => { navigationRef.goBack(); });
  /** Enters the PIN on the PIN screen on top: it goes back, then calls back with the PIN. */
  const enterPin = () => act(async () => {
    const { cb } = navigationRef.getCurrentRoute().params;
    navigationRef.goBack();
    await cb(PIN);
  });
  return {
    store,
    routes,
    open,
    openExport,
    cancelPin,
    enterPin,
    texts,
    press,
  };
}

describe('the privacy screens in the app stack', () => {
  test('open the export with its PIN screen over it', async () => {
    const { routes, openExport } = await render();

    await openExport();

    expect(routes()).toEqual(['Main', 'PrivacySettings', 'ExportPrivacyKeys', 'PinScreen']);
  });

  test('go back to the privacy settings when the export\'s PIN screen closes without the PIN', async () => {
    const { routes, openExport, cancelPin } = await render();
    await openExport();
    expect(routes()).toEqual(['Main', 'PrivacySettings', 'ExportPrivacyKeys', 'PinScreen']);

    await cancelPin();

    expect(routes()).toEqual(['Main', 'PrivacySettings']);
  });

  test('stay on the export, with the keys, when its PIN screen gives the PIN', async () => {
    const { routes, openExport, enterPin, texts } = await render();
    await openExport();

    await enterPin();

    expect(routes()).toEqual(['Main', 'PrivacySettings', 'ExportPrivacyKeys']);
    expect(texts()).toContain(SCAN_MASKED);
  });

  test('close with the export\'s PIN screen when the flag turns off', async () => {
    const { store, routes, openExport, texts } = await render();
    await openExport();
    expect(routes()).toEqual(['Main', 'PrivacySettings', 'ExportPrivacyKeys', 'PinScreen']);

    await act(async () => {
      store.dispatch(setFeatureToggles({
        ...FEATURE_TOGGLE_DEFAULTS,
        [SHIELDED_OUTPUTS_FEATURE_TOGGLE]: false,
      }));
    });

    expect(routes()).toEqual(['Main']);
    expect(texts()).not.toContain('PRIVACY SETTINGS');
    expect(texts()).not.toContain('EXPORT PRIVACY KEYS');
  });

  test('close with the unlock\'s PIN screen when the crypto provider fails', async () => {
    const { store, routes, openExport, press } = await render({ level: 'watch' });
    await openExport();
    await press('Unlock private balance');
    expect(routes()).toEqual(['Main', 'PrivacySettings', 'ExportPrivacyKeys', 'PinScreen']);

    await act(async () => {
      store.dispatch(shieldedProviderUpdate({
        status: SHIELDED_PROVIDER_STATUS.FAILED,
        error: 'self-test failed',
      }));
    });

    expect(routes()).toEqual(['Main']);
  });

  test('close the export with its PIN screen, without the privacy settings under it', async () => {
    const { store, routes, open } = await render();
    await open('ExportPrivacyKeys');
    expect(routes()).toEqual(['Main', 'ExportPrivacyKeys', 'PinScreen']);

    await act(async () => {
      store.dispatch(shieldedProviderUpdate({ status: SHIELDED_PROVIDER_STATUS.FAILED }));
    });

    expect(routes()).toEqual(['Main']);
  });

  test('close, both of them and nothing under them, when a reload starts', async () => {
    const { store, routes, openExport } = await render();
    await openExport();

    // Every start resets the shielded state, the provider's status included.
    await act(async () => { store.dispatch(startWalletRequested({})); });

    expect(routes()).toEqual(['Main']);
  });

  test('stay open, the PIN screen included, while the private balance locks', async () => {
    const { store, routes, openExport } = await render();
    await openExport();

    await act(async () => { store.dispatch(shieldedCapabilityUpdate(capability('watch'))); });

    expect(routes()).toEqual(['Main', 'PrivacySettings', 'ExportPrivacyKeys', 'PinScreen']);
  });

  test('close the privacy settings opened where the shielded UI is not available', async () => {
    const { routes, open } = await render({ flag: false });

    await open('PrivacySettings');

    expect(routes()).toEqual(['Main']);
  });
});
