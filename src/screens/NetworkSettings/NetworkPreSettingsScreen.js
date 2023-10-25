/**
 * Copyright (c) Hathor Labs and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */
import React from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableHighlight,
} from 'react-native';
import { t } from 'ttag';
import { useDispatch } from 'react-redux';
import HathorHeader from '../../components/HathorHeader';
import NewHathorButton from '../../components/NewHathorButton';
import { networkSettingsUpdateSuccess } from '../../actions';
import { PRE_SETTINGS_MAINNET, PRE_SETTINGS_TESTNET } from '../../constants';
import { CustomNetworkSettingsNav } from './CustomNetworkSettingsScreen';

const presettingsTitleText = t`Network Pre-Settings`.toUpperCase();
const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    flex: 1,
    justifyContent: 'flex-start',
    padding: 16,
    paddingBottom: 48,
  },
  centeredText: {
    fontSize: 16,
  },
  card: {
    backgroundColor: 'white',
    padding: 20,
    marginBottom: 20,
    borderRadius: 10,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 5,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  cardBody: {
    marginTop: 10,
    // Gray
    color: 'hsl(0, 0%, 55%)',
  },
  buttonContainer: {
    alignSelf: 'stretch',
    marginTop: 'auto'
  },
});

export const NetworkPreSettingsNav = Symbol('NetworkPreSettings').toString();

export function NetworkPreSettingsScreen({ navigation }) {
  const dispatch = useDispatch();
  const setMainnetNetwork = () => dispatch(networkSettingsUpdateSuccess(PRE_SETTINGS_MAINNET));
  const setTestnetNetwork = () => dispatch(networkSettingsUpdateSuccess(PRE_SETTINGS_TESTNET));
  const setCustomNetwork = () => {
    navigation.push(CustomNetworkSettingsNav);
  };

  return (
    <View style={styles.container}>
      <HathorHeader
        title={presettingsTitleText}
        onBackPress={() => navigation.goBack()}
      />
      <View style={styles.content}>
        <CustomNetwork title='Mainnet' url={PRE_SETTINGS_MAINNET.nodeUrl} onPress={setMainnetNetwork} />
        <CustomNetwork title='Testnet' url={PRE_SETTINGS_TESTNET.nodeUrl} onPress={setTestnetNetwork} />
        <View style={styles.buttonContainer}>
          <NewHathorButton
            onPress={setCustomNetwork}
            title={t`Customize`}
          />
        </View>
      </View>
    </View>
  );
}

const CustomNetwork = ({ title, url, onPress }) => (
  <TouchableHighlight
    onPress={onPress}
    underlayColor='hsl(0, 0%, 98%)'
    style={styles.card}
  >
    <View>
      <Text style={styles.cardTitle}>{title}</Text>
      <Text style={styles.cardBody}>{url}</Text>
    </View>
  </TouchableHighlight>
);
