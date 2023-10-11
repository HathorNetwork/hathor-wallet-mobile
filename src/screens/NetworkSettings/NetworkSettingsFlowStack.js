/**
 * Copyright (c) Hathor Labs and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */
import { createStackNavigator } from '@react-navigation/stack';
import { useSelector } from 'react-redux';
import { eq } from 'lodash';
import { PRE_SETTINGS_MAINNET, PRE_SETTINGS_TESTNET } from '../../constants';
import { CustomNetworkSettingsNav, CustomNetworkSettingsScreen } from './CustomNetworkSettingsScreen';
import { NetworkPreSettingsNav, NetworkPreSettingsScreen } from './NetworkPreSettingsScreen';
import { NetworkSettingsDisclaimerNav, NetworkSettingsDisclaimerScreen } from './NetworkSettingsDisclaimerScreen';

export const NetworkSettingsFlowNav = Symbol('NetworkSettingsFlowStack').toString();

const isCustomNetwork = (networkSettings) => {
  return !(eq(PRE_SETTINGS_MAINNET, networkSettings) || eq(PRE_SETTINGS_TESTNET, networkSettings));
};

export const NetworkSettingsFlowStack = ({ navigation }) => {
  const networkSettings = useSelector((state) => state.networkSettings);
  const initialNav = isCustomNetwork(networkSettings)
    ? NetworkPreSettingsNav
    : NetworkSettingsDislaimerNav;

  const FlowStack = createStackNavigator();
  return (
    <FlowStack.Navigator
      initialRouteName={initialNav}
      screenOptions={{
        headerShown: false,
      }}
    >
      <FlowStack.Screen
        name={NetworkSettingsDisclaimerNav}
        component={NetworkSettingsDisclaimerScreen}
      />
      <FlowStack.Screen name={NetworkPreSettingsNav} component={NetworkPreSettingsScreen} />
      <FlowStack.Screen name={CustomNetworkSettingsNav} component={CustomNetworkSettingsScreen} />
    </FlowStack.Navigator>
  );
};
