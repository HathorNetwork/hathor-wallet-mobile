import React, { useEffect, useState } from 'react';
import { View, Text, TextInput, Button, StyleSheet } from 'react-native';
import { useDispatch, useSelector } from 'react-redux';
import { t } from 'ttag';
import { networkSettingsUpdate, networkSettingsUpdateReady } from '../../actions';
import FeedbackModal from '../../components/FeedbackModal';
import HathorHeader from '../../components/HathorHeader';
import NewHathorButton from '../../components/NewHathorButton';
import SimpleInput from '../../components/SimpleInput';
import { NETWORKSETTINGS_STATUS } from '../../constants';
import errorIcon from '../../assets/images/icErrorBig.png';
import Spinner from '../../components/Spinner';

const customNetworkSettingsTitleText = t`Custom Network Settings`.toUpperCase();
const warningText = t`Any change to the network settings cannot be validated by Hathor. Only change if you know what you are doing.`;
const feedbackLoadingText = t`Updating custom network settings...`;
const feedbackFailedText = t`There was an error while customizing network settings. Please try again later.`;

/**
 * Check if the network settings status is failed.
 * @param {object} networkSettingsStatus - status from redux store
 * @returns {boolean} - true if the status is failed, false otherwise
 */
const hasFailed = (networkSettingsStatus) => {
  return networkSettingsStatus === NETWORKSETTINGS_STATUS.FAILED;
};

/**
 * Check if the network settings status is loading.
 * @param {object} networkSettingsStatus - status from redux store
 * @returns {boolean} - true if the status is loading, false otherwise
 */
const isLoading = (networkSettingsStatus) => {
  return networkSettingsStatus === NETWORKSETTINGS_STATUS.LOADING;
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    flex: 1,
    padding: 16,
    paddingBottom: 48,
  },
  feedbackModalIcon: {
    height: 105,
    width: 105
  },
  warningContainer: {
    borderRadius: 8,
    backgroundColor: 'hsl(47, 100%, 62%)', // warning yellow
    marginBottom: 16,
  },
  warningMessage: {
    fontSize: 14,
    color: 'black',
    padding: 12,
  },
  input: {
    marginBottom: 24,
  },
  buttonContainer: {
    alignSelf: 'stretch',
    marginTop: 'auto',
  },
});

export const CustomNetworkSettingsNav = Symbol('CustomNetworkSettings').toString();

export const CustomNetworkSettingsScreen = ({ navigation }) => {
  const dispatch = useDispatch();
  const networkSettings = useSelector((state) => state.networkSettings);
  const networkSettingsErrors = useSelector((state) => state.networkSettingsErrors);
  const networkSettingsStatus = useSelector((state) => state.networkSettingsStatus);

  const [formData, setFormData] = useState({
    nodeUrl: networkSettings.nodeUrl,
    explorerUrl: networkSettings.explorerUrl,
    explorerServiceUrl: networkSettings.explorerServiceUrl,
    walletServiceUrl: networkSettings.walletServiceUrl || '',
    walletServiceWsUrl: networkSettings.walletServiceWsUrl || '',
  });

  const [errorMessages, setErrorMessages] = useState({
    nodeUrl: networkSettingsErrors?.nodeUrl || '',
    explorerUrl: networkSettingsErrors?.explorerUrl || '',
    explorerServiceUrl: networkSettingsErrors?.explorerServiceUrl || '',
    walletServiceUrl: networkSettingsErrors?.walletServiceUrl || '',
    walletServiceWsUrl: networkSettingsErrors?.walletServiceWsUrl || '',
  });

  /**
   * @param {'nodeUrl' | 'explorerUrl' | 'explorerServiceUrl' | 'walletServiceUrl' | 'walletServiceWsUrl' } name
   */
  const handleInputChange = (name) => {
    return (value) => {
      setFormData({
        ...formData,
        [name]: value,
      });
    };
  };

  const handleFeedbackModalDismiss = () => {
    dispatch(networkSettingsUpdateReady());
  };

  const handleSubmit = () => {
    // Validation logic
    const errors = {};

    if (!formData.nodeUrl) {
      errors.nodeUrl = t`nodeUrl is required.`;
    }

    if (!formData.explorerUrl) {
      errors.explorerUrl = t`explorerUrl is required.`;
    }

    if (!formData.explorerServiceUrl) {
      errors.explorerServiceUrl = t`explorerServiceUrl is required.`;
    }

    setErrorMessages(errors);
    if (Object.keys(errors).length > 0) {
      return;
    }

    dispatch(networkSettingsUpdate(formData));
  };

  useEffect(() => {
    setErrorMessages({
      nodeUrl: networkSettingsErrors?.nodeUrl || '',
      explorerUrl: networkSettingsErrors?.explorerUrl || '',
      explorerServiceUrl: networkSettingsErrors?.explorerServiceUrl || '',
      walletServiceUrl: networkSettingsErrors?.walletServiceUrl || '',
      walletServiceWsUrl: networkSettingsErrors?.walletServiceWsUrl || '',
    });
  }, [networkSettingsErrors]);

  return (
    <View style={styles.container}>
      <HathorHeader
        title={customNetworkSettingsTitleText}
        onBackPress={() => navigation.goBack()}
      />

      {isLoading(networkSettingsStatus) && (
        <FeedbackModal
          icon={<Spinner />}
          text={feedbackLoadingText}
        />
      )}

      {hasFailed(networkSettingsStatus) && (
        <FeedbackModal
          icon={(<Image source={errorIcon} style={styles.feedbackModalIcon} resizeMode='contain' />)}
          text={feedbackFailedText}
          onDismiss={handleFeedbackModalDismiss}
        />
      )}

      <View style={styles.content}>
        <View style={styles.warningContainer}>
          <Text style={styles.warningMessage}>{warningText}</Text>
        </View>
        <SimpleInput
          containerStyle={styles.input}
          label={t`Node URL`}
          autoFocus
          onChangeText={handleInputChange('nodeUrl')}
          error={errorMessages.nodeUrl}
          value={formData.nodeUrl}
        />

        <SimpleInput
          containerStyle={styles.input}
          label={t`Explorer URL`}
          autoFocus
          onChangeText={handleInputChange('explorerUrl')}
          error={errorMessages.explorerUrl}
          value={formData.explorerUrl}
        />

        <SimpleInput
          containerStyle={styles.input}
          label={t`Explorer Service URL`}
          autoFocus
          onChangeText={handleInputChange('explorerServiceUrl')}
          error={errorMessages.explorerServiceUrl}
          value={formData.explorerServiceUrl}
        />

        <SimpleInput
          containerStyle={styles.input}
          label={t`Wallet Service URL (optional)`}
          autoFocus
          onChangeText={handleInputChange('walletServiceUrl')}
          error={errorMessages.walletServiceUrl}
          value={formData.walletServiceUrl}
        />

        <SimpleInput
          containerStyle={styles.input}
          label={t`Wallet Service WS URL (optional)`}
          autoFocus
          onChangeText={handleInputChange('walletServiceWsUrl')}
          error={errorMessages.walletServiceWsUrl}
          value={formData.walletServiceWsUrl}
        />

        <View style={styles.buttonContainer}>
          <NewHathorButton
            onPress={handleSubmit}
            title={t`Send`} />
        </View>
      </View>
    </View>
  );
};
