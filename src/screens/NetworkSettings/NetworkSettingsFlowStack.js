import { createStackNavigator } from '@react-navigation/stack';
import { NetworkSettingsDislaimerNav, NetworkSettingsDislaimerScreen } from './NetworkSettingsDisclaimerScreen';

export const NetworkSettingsFlowNav = Symbol('NetworkSettingsFlowStack').toString();

export const NetworkSettingsFlowStack = ({ navigation }) => {
  const FlowStack = createStackNavigator();
  return (
    <FlowStack.Navigator
      initialRouteName={NetworkSettingsDislaimerNav}
      screenOptions={{
        headerShown: false,
      }}
    >
      <FlowStack.Screen name={NetworkSettingsDislaimerNav} component={NetworkSettingsDislaimerScreen} />
    </FlowStack.Navigator>
  );
}
