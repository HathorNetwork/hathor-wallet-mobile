import { createStackNavigator } from '@react-navigation/stack';
import { CustomNetworkSettingsNav, CustomNetworkSettingsScreen } from './CustomNetworkSettingsScreen';
import { NetworkPreSettingsNav, NetworkPreSettingsScreen } from './NetworkPreSettingsScreen';
import { NetworkSettingsDislaimerNav, NetworkSettingsDislaimerScreen } from './NetworkSettingsDisclaimerScreen';

export const NetworkSettingsFlowNav = Symbol('NetworkSettingsFlowStack').toString();

export const NetworkSettingsFlowStack = ({ navigation }) => {
  const FlowStack = createStackNavigator();
  return (
    <FlowStack.Navigator
      initialRouteName={CustomNetworkSettingsNav}
      screenOptions={{
        headerShown: false,
      }}
    >
      <FlowStack.Screen name={NetworkSettingsDislaimerNav} component={NetworkSettingsDislaimerScreen} />
      <FlowStack.Screen name={NetworkPreSettingsNav} component={NetworkPreSettingsScreen} />
      <FlowStack.Screen name={CustomNetworkSettingsNav} component={CustomNetworkSettingsScreen} />
    </FlowStack.Navigator>
  );
}
