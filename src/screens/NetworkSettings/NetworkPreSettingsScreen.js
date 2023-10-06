import React from 'react';
import {
  StyleSheet,
  View,
  Text,
} from 'react-native';
import { t } from 'ttag';
import HathorHeader from '../../components/HathorHeader';
import NewHathorButton from '../../components/NewHathorButton';

const riskDisclaimerTitleText = t`Network Pre-Settings`.toUpperCase();
const style = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    flex: 1,
    justifyContent: 'space-between',
    padding: 16,
    paddingBottom: 48,
  },
  centeredText: {
    fontSize: 16,
  },
  buttonContainer: {
    alignSelf: 'stretch',
  },
});

export const NetworkPreSettingsNav = Symbol('NetworkPreSettings').toString();

export function NetworkPreSettingsScreen({ navigation }) {
  return (
    <View style={style.container}>
      <HathorHeader
        title={riskDisclaimerTitleText}
        onBackPress={() => navigation.goBack()}
      />
      <View style={styles.container}>
        <Card title="Mainnet" url="https://example.com/url1" />
        <Card title="Testnet" url="https://example.com/url2" />
        <View style={style.buttonContainer}>
          <NewHathorButton
            onPress={() => navigation.navigate('Settings') }
            title={t`Customize`} />
        </View>
      </View>
    </View>
  );
}

const Card = ({ title, url }) => (
  <View style={styles.card}>
    <Text style={styles.cardTitle}>{title}</Text>
    <Text style={styles.cardBody}>{url}</Text>
  </View>
);

const styles = StyleSheet.create({
  container: {
    flex: 1,
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
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
    fontSize: 20,
    fontWeight: 'bold',
  },
  cardBody: {
    marginTop: 10,
    color: 'blue',
  },
});
