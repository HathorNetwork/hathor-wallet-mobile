/**
 * Copyright (c) Hathor Labs and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import React from 'react';
import { useSelector } from 'react-redux';
import {
  ScrollView,
  StyleSheet,
  SafeAreaView,
  Text,
  View,
  TouchableOpacity,
} from 'react-native';

import OfflineBar from '../../components/OfflineBar';
import { HathorList, ListMenu } from '../../components/HathorList';
import { PRIMARY_COLOR } from '../../constants';
import { getLightBackground } from '../../utils';


const style = StyleSheet.create({
  scrollView: {
    flexGrow: 1,
    alignItems: 'center',
  },
  networkContainerView: {
    marginTop: 24,
    marginBottom: 24,
  },
  networkView: {
    backgroundColor: getLightBackground(0.1),
    margin: 8,
    padding: 8,
    borderRadius: 8,
    alignItems: 'center',
  },
  networkText: {
    color: PRIMARY_COLOR,
    fontSize: 16,
    fontWeight: 'bold',
  },
  logoView: {
    height: 22,
    width: 100,
    marginTop: 16,
    marginBottom: 16,
  },
  logo: {
    height: 22,
    width: 100,
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    marginTop: 16,
    marginBottom: 16,
  },
});

const scanStyles = StyleSheet.create({
  button: {
    position: 'absolute',
    bottom: 32,
    backgroundColor: '#2196F3',
    borderRadius: 30,
    paddingHorizontal: 30,
    paddingVertical: 10,
    elevation: 5, // for Android
    shadowColor: '#000', // for iOS
    shadowOffset: { width: 0, height: 2 }, // for iOS
    shadowOpacity: 0.25, // for iOS
    shadowRadius: 3.84, // for iOS
  },
  text: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
  },
});

const ScanButton = ({ onPress }) => {
  return (
    <TouchableOpacity onPress={onPress} style={scanStyles.button}>
      <Text style={scanStyles.text}>New Session</Text>
    </TouchableOpacity>
  );
};

export default function WalletConnectList({ navigation }) {
  const connectedSessions = useSelector((state) => state.walletConnectSessions);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#F7F7F7' }}>
      <ScrollView contentContainerStyle={style.scrollView}>
        <Text style={style.title}>Connected Wallets</Text>
        <HathorList infinity>
          {Object.keys(connectedSessions).map((key) => (
            <ListMenu
              title={(
                <View style={{ flex: 1 }}>
                  <Text style={{ marginBottom: 8, color: 'rgba(0, 0, 0, 0.5)', fontSize: 12 }}>
                    {connectedSessions[key].peer.metadata.name}
                  </Text>

                  <Text numberOfLines={1}>{connectedSessions[key].namespaces.hathor.accounts[0]}</Text>
                </View>
              )}
              onPress={() => navigation.navigate('About')}
            />
          ))}
        </HathorList>
        <ScanButton onPress={() => navigation.navigate('WalletConnectScan')} />
      </ScrollView>
      <OfflineBar />
    </SafeAreaView>
  );
}
