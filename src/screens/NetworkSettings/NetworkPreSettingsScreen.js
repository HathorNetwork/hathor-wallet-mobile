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
  Image,
} from 'react-native';
import { t } from 'ttag';
import { useDispatch, useSelector } from 'react-redux';
import HathorHeader from '../../components/HathorHeader';
import NewHathorButton from '../../components/NewHathorButton';
import Spinner from '../../components/Spinner';
import FeedbackModal from '../../components/FeedbackModal';
import { networkSettingsPersistStore, networkSettingsUpdateReady } from '../../actions';
import { PRE_SETTINGS_MAINNET, PRE_SETTINGS_NANO_TESTNET, PRE_SETTINGS_TESTNET } from '../../constants';
import { CustomNetworkSettingsNav } from './CustomNetworkSettingsScreen';
import { feedbackSucceedText, feedbackFailedText, feedbackLoadingText, hasFailed, isLoading, hasSucceeded } from './helper';
import errorIcon from '../../assets/images/icErrorBig.png';
import checkIcon from '../../assets/images/icCheckBig.png';

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
  feedbackModalIcon: {
    height: 105,
    width: 105
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
  const networkSettingsStatus = useSelector((state) => state.networkSettingsStatus);
  const setMainnetNetwork = () => dispatch(networkSettingsPersistStore(PRE_SETTINGS_MAINNET));
  const setTestnetNetwork = () => dispatch(networkSettingsPersistStore(PRE_SETTINGS_TESTNET));
  const setNanoTestnetNetwork = () => dispatch(
    networkSettingsPersistStore(PRE_SETTINGS_NANO_TESTNET),
  );
  const setCustomNetwork = () => {
    navigation.push(CustomNetworkSettingsNav);
  };

  const handleFeedbackModalDismiss = (navigate) => {
    dispatch(networkSettingsUpdateReady());
    if (navigate) {
      navigation.navigate('Dashboard');
    }
  };

  return (
    <View style={styles.container}>
      <HathorHeader
        title={presettingsTitleText}
        onBackPress={() => navigation.goBack()}
      />

      {isLoading(networkSettingsStatus) && (
        <FeedbackModal
          icon={<Spinner />}
          text={feedbackLoadingText}
        />
      )}

      {hasSucceeded(networkSettingsStatus) && (
        <FeedbackModal
          icon={(<Image source={checkIcon} style={styles.feedbackModalIcon} resizeMode='contain' />)}
          text={feedbackSucceedText}
          onDismiss={() => handleFeedbackModalDismiss(true)}
        />
      )}

      {hasFailed(networkSettingsStatus) && (
        <FeedbackModal
          icon={(<Image source={errorIcon} style={styles.feedbackModalIcon} resizeMode='contain' />)}
          text={feedbackFailedText}
          onDismiss={() => handleFeedbackModalDismiss(false)}
        />
      )}

      <View style={styles.content}>
        <CustomNetwork title='Mainnet' url={PRE_SETTINGS_MAINNET.nodeUrl} onPress={setMainnetNetwork} />
        <CustomNetwork title='Testnet' url={PRE_SETTINGS_TESTNET.nodeUrl} onPress={setTestnetNetwork} />
        <CustomNetwork title='Nano Testnet' url={PRE_SETTINGS_NANO_TESTNET.nodeUrl} onPress={setNanoTestnetNetwork} />
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
