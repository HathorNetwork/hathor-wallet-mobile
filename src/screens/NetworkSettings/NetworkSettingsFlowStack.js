import { createStackNavigator } from '@react-navigation/stack';
import { useSelector } from 'react-redux';
import { eq } from 'lodash';
import { PRE_SETTINGS_MAINNET, PRE_SETTINGS_TESTNET } from '../../constants';
import { CustomNetworkSettingsNav, CustomNetworkSettingsScreen } from './CustomNetworkSettingsScreen';
import { NetworkPreSettingsNav, NetworkPreSettingsScreen } from './NetworkPreSettingsScreen';
import { NetworkSettingsDislaimerNav, NetworkSettingsDislaimerScreen } from './NetworkSettingsDisclaimerScreen';

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
      <FlowStack.Screen name={NetworkSettingsDislaimerNav} component={NetworkSettingsDislaimerScreen} />
      <FlowStack.Screen name={NetworkPreSettingsNav} component={NetworkPreSettingsScreen} />
      <FlowStack.Screen name={CustomNetworkSettingsNav} component={CustomNetworkSettingsScreen} />
    </FlowStack.Navigator>
  );
}
