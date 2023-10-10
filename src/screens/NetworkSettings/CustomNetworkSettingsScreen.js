import React, { useEffect, useState } from 'react';
import { View, Text, TextInput, Button, StyleSheet } from 'react-native';
import { useDispatch, useSelector } from 'react-redux';
import { t } from 'ttag';
import { networkSettingsUpdate } from '../../actions';
import HathorHeader from '../../components/HathorHeader';
import NewHathorButton from '../../components/NewHathorButton';
import SimpleInput from '../../components/SimpleInput';

const customNetworkSettingsTitleText = t`Custom Network Settings`.toUpperCase();
const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    flex: 1,
    padding: 16,
    paddingBottom: 48,
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
      <View style={styles.content}>
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
