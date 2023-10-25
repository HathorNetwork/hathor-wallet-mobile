import { createStackNavigator } from '@react-navigation/stack';
import { NetworkSettingsDisclaimerNav, NetworkSettingsDisclaimerScreen } from './NetworkSettingsDisclaimerScreen';

export const NetworkSettingsFlowNav = Symbol('NetworkSettingsFlowStack').toString();

export const NetworkSettingsFlowStack = ({ navigation }) => {
  const FlowStack = createStackNavigator();
  return (
    <FlowStack.Navigator
      initialRouteName={NetworkSettingsDisclaimerNav}
      screenOptions={{
        headerShown: false,
      }}
    >
      <FlowStack.Screen
        name={NetworkSettingsDisclaimerNav}
        component={NetworkSettingsDisclaimerScreen}
      />
    </FlowStack.Navigator>
  );
};
