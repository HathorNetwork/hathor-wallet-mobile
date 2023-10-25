import { createStackNavigator } from '@react-navigation/stack';

export const NetworkSettingsFlowNav = Symbol('NetworkSettingsFlowStack').toString();

export const NetworkSettingsFlowStack = ({ navigation }) => {
  const FlowStack = createStackNavigator();
  return (
    <FlowStack.Navigator
      initialRouteName='NetworkSettingsDisclaimer'
      screenOptions={{
        headerShown: false,
      }}
    />
  );
};
