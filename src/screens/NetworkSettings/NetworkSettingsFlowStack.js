/**
 * Copyright (c) Hathor Labs and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */
import { createStackNavigator } from '@react-navigation/stack';
import { NetworkPreSettingsNav, NetworkPreSettingsScreen } from './NetworkPreSettingsScreen';
import { NetworkSettingsDisclaimerNav, NetworkSettingsDisclaimerScreen } from './NetworkSettingsDisclaimerScreen';

export const NetworkSettingsFlowNav = Symbol('NetworkSettingsFlowStack').toString();

export const NetworkSettingsFlowStack = ({ navigation }) => {
  const FlowStack = createStackNavigator();
  return (
    <FlowStack.Navigator
      initialRouteName={NetworkPreSettingsNav}
      screenOptions={{
        headerShown: false,
      }}
    >
      <FlowStack.Screen
        name={NetworkSettingsDisclaimerNav}
        component={NetworkSettingsDisclaimerScreen}
      />
      <FlowStack.Screen name={NetworkPreSettingsNav} component={NetworkPreSettingsScreen} />
    </FlowStack.Navigator>
  );
};
