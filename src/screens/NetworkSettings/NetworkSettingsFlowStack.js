/**
 * Copyright (c) Hathor Labs and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */
import { createStackNavigator } from '@react-navigation/stack';
import { CustomNetworkSettingsNav, CustomNetworkSettingsScreen } from './CustomNetworkSettingsScreen';
import { NetworkPreSettingsNav, NetworkPreSettingsScreen } from './NetworkPreSettingsScreen';
import { NetworkSettingsDisclaimerNav, NetworkSettingsDisclaimerScreen } from './NetworkSettingsDisclaimerScreen';

export const NetworkSettingsFlowNav = Symbol('NetworkSettingsFlowStack').toString();

export const NetworkSettingsFlowStack = () => {
  const FlowStack = createStackNavigator();
  return (
    <FlowStack.Navigator
      initialRouteName={NetworkSettingsDislaimerNav}
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
