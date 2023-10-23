import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Image } from 'react-native';
import { useDispatch, useSelector } from 'react-redux';
import { t } from 'ttag';
import { isEmpty } from 'lodash';
import { networkSettingsUpdateRequest, networkSettingsUpdateErrors, networkSettingsUpdateReady } from '../../actions';
import FeedbackModal from '../../components/FeedbackModal';
import HathorHeader from '../../components/HathorHeader';
import NewHathorButton from '../../components/NewHathorButton';
import SimpleInput from '../../components/SimpleInput';
import { NETWORKSETTINGS_STATUS } from '../../constants';
import errorIcon from '../../assets/images/icErrorBig.png';
import Spinner from '../../components/Spinner';

const customNetworkSettingsTitleText = t`Custom Network Settings`.toUpperCase();
const warningText = t`Any token outside mainnet network bear no value. Only change if you know what you are doing.`;
const feedbackLoadingText = t`Updating custom network settings...`;
const feedbackFailedText = t`There was an error while customizing network settings. Please try again later.`;

/**
 * Check if the network settings status is failed.
 * @param {object} networkSettingsStatus - status from redux store
 * @returns {boolean} - true if the status is failed, false otherwise
 */
// eslint-disable-next-line max-len
const hasFailed = (networkSettingsStatus) => networkSettingsStatus === NETWORKSETTINGS_STATUS.FAILED;

/**
 * Check if the network settings status is loading.
 * @param {object} networkSettingsStatus - status from redux store
 * @returns {boolean} - true if the status is loading, false otherwise
 */
// eslint-disable-next-line max-len
const isLoading = (networkSettingsStatus) => networkSettingsStatus === NETWORKSETTINGS_STATUS.LOADING;

/**
 * Verifies if the errorModel of the form has an error message.
 */
function hasError(errorModel) {
  return Object
    .values({ ...errorModel })
    .reduce((_hasError, currValue) => _hasError || !isEmpty(currValue), false);
}

/**
 * Validates the formModel, returning the errorModel.
 * If there is no error in the formModel, the errorModel is returned empty.
 */
function validate(formModel) {
  const errorModel = {};

  if (!formModel.nodeUrl) {
    errorModel.nodeUrl = t`nodeUrl is required.`;
  }

  if (!formModel.explorerUrl) {
    errorModel.explorerUrl = t`explorerUrl is required.`;
  }

  if (!formModel.explorerServiceUrl) {
    errorModel.explorerServiceUrl = t`explorerServiceUrl is required.`;
  }

  return errorModel;
}

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
    backgroundColor: 'hsl(47, 100%, 86%)', // warning yellow
    marginBottom: 32,
    borderWidth: 1,
    borderColor: 'hsl(47, 100%, 70%)', // warning yellow - 16% light
  },
  warningMessage: {
    fontSize: 14,
    color: 'hsl(47, 100%, 22%)', // warning yellow - 64% light
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

  const [formModel, setFormModel] = useState({
    nodeUrl: networkSettings.nodeUrl,
    explorerUrl: networkSettings.explorerUrl,
    explorerServiceUrl: networkSettings.explorerServiceUrl,
    walletServiceUrl: networkSettings.walletServiceUrl || '',
    walletServiceWsUrl: networkSettings.walletServiceWsUrl || '',
  });

  const [errorModel, setErrorModel] = useState({
    nodeUrl: networkSettingsErrors?.nodeUrl || '',
    explorerUrl: networkSettingsErrors?.explorerUrl || '',
    explorerServiceUrl: networkSettingsErrors?.explorerServiceUrl || '',
    walletServiceUrl: networkSettingsErrors?.walletServiceUrl || '',
    walletServiceWsUrl: networkSettingsErrors?.walletServiceWsUrl || '',
  });

  // eslint-disable-next-line max-len
  /* @param {'nodeUrl' | 'explorerUrl' | 'explorerServiceUrl' | 'walletServiceUrl' | 'walletServiceWsUrl' } name */
  const handleInputChange = (name) => (value) => {
    // update error model
    const errors = { ...errorModel };
    delete errors[name];
    setErrorModel(errors);

    // update form model
    const form = {
      ...formModel,
      [name]: value,
    };
    setFormModel(form);

    // validate form model and update error model
    setErrorModel(validate(form));
  };

  const handleFeedbackModalDismiss = () => {
    dispatch(networkSettingsUpdateReady());
  };

  const handleSubmit = () => {
    const errors = validate(formModel);
    if (hasError(errors)) {
      setErrorModel(errors);
      return;
    }

    dispatch(networkSettingsUpdateRequest(formModel));
  };

  useEffect(() => {
    setErrorModel({
      nodeUrl: networkSettingsErrors?.nodeUrl || '',
      explorerUrl: networkSettingsErrors?.explorerUrl || '',
      explorerServiceUrl: networkSettingsErrors?.explorerServiceUrl || '',
      walletServiceUrl: networkSettingsErrors?.walletServiceUrl || '',
      walletServiceWsUrl: networkSettingsErrors?.walletServiceWsUrl || '',
    });
  }, [networkSettingsErrors]);

  useEffect(() => function cleanUp() {
    dispatch(networkSettingsUpdateErrors({}));
  }, []);

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
          error={errorModel.nodeUrl}
          value={formModel.nodeUrl}
        />

        <SimpleInput
          containerStyle={styles.input}
          label={t`Explorer URL`}
          autoFocus
          onChangeText={handleInputChange('explorerUrl')}
          error={errorModel.explorerUrl}
          value={formModel.explorerUrl}
        />

        <SimpleInput
          containerStyle={styles.input}
          label={t`Explorer Service URL`}
          autoFocus
          onChangeText={handleInputChange('explorerServiceUrl')}
          error={errorModel.explorerServiceUrl}
          value={formModel.explorerServiceUrl}
        />

        <SimpleInput
          containerStyle={styles.input}
          label={t`Wallet Service URL (optional)`}
          autoFocus
          onChangeText={handleInputChange('walletServiceUrl')}
          error={errorModel.walletServiceUrl}
          value={formModel.walletServiceUrl}
        />

        <SimpleInput
          containerStyle={styles.input}
          label={t`Wallet Service WS URL (optional)`}
          autoFocus
          onChangeText={handleInputChange('walletServiceWsUrl')}
          error={errorModel.walletServiceWsUrl}
          value={formModel.walletServiceWsUrl}
        />

        <View style={styles.buttonContainer}>
          <NewHathorButton
            disabled={hasError(errorModel)}
            onPress={handleSubmit}
            title={t`Send`}
          />
        </View>
      </View>
    </View>
  );
};
