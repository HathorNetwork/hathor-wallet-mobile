import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Image } from 'react-native';
import { useDispatch, useSelector } from 'react-redux';
import { t } from 'ttag';
import { isEmpty } from 'lodash';
import { networkSettingsUpdateRequest, networkSettingsUpdateInvalid, networkSettingsUpdateReady } from '../../actions';
import FeedbackModal from '../../components/FeedbackModal';
import HathorHeader from '../../components/HathorHeader';
import NewHathorButton from '../../components/NewHathorButton';
import SimpleInput from '../../components/SimpleInput';
import errorIcon from '../../assets/images/icErrorBig.png';
import checkIcon from '../../assets/images/icCheckBig.png';
import Spinner from '../../components/Spinner';
import { hasSucceed, hasFailed, isLoading } from './helper';
import { AlertUI } from '../../styles/themes';

const customNetworkSettingsTitleText = t`Custom Network Settings`.toUpperCase();
const warningText = t`Any token outside mainnet network bear no value. Only change if you know what you are doing.`;
const feedbackLoadingText = t`Updating custom network settings...`;
const feedbackSucceedText = t`Network settings successfully customized.`;
const feedbackFailedText = t`There was an error while customizing network settings. Please try again later.`;

/**
 * Verifies if the invalidModel of the form has an error message.
 */
function hasError(invalidModel) {
  return Object
    .values({ ...invalidModel })
    .reduce((_hasError, currValue) => _hasError || !isEmpty(currValue), false);
}

/**
 * Validates the formModel, returning the invalidModel.
 * If there is no error in the formModel, the invalidModel is returned empty.
 */
function validate(formModel) {
  const invalidModel = {};

  if (!formModel.nodeUrl) {
    invalidModel.nodeUrl = t`nodeUrl is required.`;
  }

  if (!formModel.explorerUrl) {
    invalidModel.explorerUrl = t`explorerUrl is required.`;
  }

  if (!formModel.explorerServiceUrl) {
    invalidModel.explorerServiceUrl = t`explorerServiceUrl is required.`;
  }

  return invalidModel;
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
    backgroundColor: AlertUI.lightColor,
    marginBottom: 32,
    borderWidth: 1,
    borderColor: AlertUI.baseHslColor.addLightness(4).toString(),
  },
  warningMessage: {
    fontSize: 14,
    color: AlertUI.darkColor,
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
  const networkSettingsInvalid = useSelector((state) => state.networkSettingsInvalid);
  const networkSettingsStatus = useSelector((state) => state.networkSettingsStatus);

  const [formModel, setFormModel] = useState({
    nodeUrl: networkSettings.nodeUrl,
    explorerUrl: networkSettings.explorerUrl,
    explorerServiceUrl: networkSettings.explorerServiceUrl,
    walletServiceUrl: networkSettings.walletServiceUrl || '',
    walletServiceWsUrl: networkSettings.walletServiceWsUrl || '',
  });

  const [invalidModel, setInvalidModel] = useState({
    nodeUrl: networkSettingsInvalid?.nodeUrl || '',
    explorerUrl: networkSettingsInvalid?.explorerUrl || '',
    explorerServiceUrl: networkSettingsInvalid?.explorerServiceUrl || '',
    walletServiceUrl: networkSettingsInvalid?.walletServiceUrl || '',
    walletServiceWsUrl: networkSettingsInvalid?.walletServiceWsUrl || '',
  });

  // eslint-disable-next-line max-len
  /* @param {'nodeUrl' | 'explorerUrl' | 'explorerServiceUrl' | 'walletServiceUrl' | 'walletServiceWsUrl' } name */
  const handleInputChange = (name) => (value) => {
    // update invalid model
    const invalidModelCopy = { ...invalidModel };
    delete invalidModelCopy[name];
    setInvalidModel(invalidModelCopy);

    // update form model
    const form = {
      ...formModel,
      [name]: value,
    };
    setFormModel(form);

    // validate form model and update invalid model
    setInvalidModel(validate(form));
  };

  const handleFeedbackModalDismiss = () => {
    dispatch(networkSettingsUpdateReady());
  };

  const handleSubmit = () => {
    const newInvalidModel = validate(formModel);
    if (hasError(newInvalidModel)) {
      setInvalidModel(newInvalidModel);
      return;
    }

    dispatch(networkSettingsUpdateRequest(formModel));
  };

  useEffect(() => {
    setInvalidModel({
      nodeUrl: networkSettingsInvalid?.nodeUrl || '',
      explorerUrl: networkSettingsInvalid?.explorerUrl || '',
      explorerServiceUrl: networkSettingsInvalid?.explorerServiceUrl || '',
      walletServiceUrl: networkSettingsInvalid?.walletServiceUrl || '',
      walletServiceWsUrl: networkSettingsInvalid?.walletServiceWsUrl || '',
    });
  }, [networkSettingsInvalid]);

  useEffect(() => function cleanUp() {
    dispatch(networkSettingsUpdateInvalid({}));
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

      {hasSucceed(networkSettingsStatus) && (
        <FeedbackModal
          icon={(<Image source={checkIcon} style={styles.feedbackModalIcon} resizeMode='contain' />)}
          text={feedbackSucceedText}
          onDismiss={handleFeedbackModalDismiss}
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
          error={invalidModel.nodeUrl}
          value={formModel.nodeUrl}
        />

        <SimpleInput
          containerStyle={styles.input}
          label={t`Explorer URL`}
          autoFocus
          onChangeText={handleInputChange('explorerUrl')}
          error={invalidModel.explorerUrl}
          value={formModel.explorerUrl}
        />

        <SimpleInput
          containerStyle={styles.input}
          label={t`Explorer Service URL`}
          autoFocus
          onChangeText={handleInputChange('explorerServiceUrl')}
          error={invalidModel.explorerServiceUrl}
          value={formModel.explorerServiceUrl}
        />

        <SimpleInput
          containerStyle={styles.input}
          label={t`Wallet Service URL (optional)`}
          autoFocus
          onChangeText={handleInputChange('walletServiceUrl')}
          error={invalidModel.walletServiceUrl}
          value={formModel.walletServiceUrl}
        />

        <SimpleInput
          containerStyle={styles.input}
          label={t`Wallet Service WS URL (optional)`}
          autoFocus
          onChangeText={handleInputChange('walletServiceWsUrl')}
          error={invalidModel.walletServiceWsUrl}
          value={formModel.walletServiceWsUrl}
        />

        <View style={styles.buttonContainer}>
          <NewHathorButton
            disabled={hasError(invalidModel)}
            onPress={handleSubmit}
            title={t`Send`}
          />
        </View>
      </View>
    </View>
  );
};
