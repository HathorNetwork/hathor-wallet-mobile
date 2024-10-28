import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Image, ScrollView, KeyboardAvoidingView } from 'react-native';
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
import { hasSucceeded, hasFailed, isLoading } from './helper';
import { AlertUI } from '../../styles/themes';
import { WALLET_SERVICE_FEATURE_TOGGLE } from '../../constants';

const customNetworkSettingsTitleText = t`Custom Network Settings`.toUpperCase();
const warningText = t`Any token outside mainnet network bear no value. Only change if you know what you are doing.`;
const feedbackLoadingText = t`Updating custom network settings...`;
const feedbackSucceededText = t`Network settings successfully customized.`;
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

  if (!formModel.txMiningServiceUrl) {
    invalidModel.txMiningServiceUrl = t`txMiningServiceUrl is required.`;
  }

  // if any wallet-service fields have a value, then evaluate, otherwise pass
  if (formModel.walletServiceUrl || formModel.walletServiceWsUrl) {
    // if not both wallet-service fields have a value, then evaluate, otherwise pass
    if (!(formModel.walletServiceUrl && formModel.walletServiceWsUrl)) {
      // invalidade the one that don't have a value
      if (!formModel.walletServiceUrl) {
        invalidModel.walletServiceUrl = t`walletServiceUrl is required when walletServiceWsUrl is filled.`;
      }
      if (!formModel.walletServiceWsUrl) {
        invalidModel.walletServiceWsUrl = t`walletServiceWsUrl is required when walletServiceUrl is filled.`;
      }
    }
  }

  return invalidModel;
}

const styles = StyleSheet.create({
  wrapper: {
    flex: 1,
  },
  keyboardWrapper: {
    flex: 1,
  },
  container: {
    paddingHorizontal: 16,
  },
  feedbackModalIcon: {
    height: 105,
    width: 105
  },
  warningWrapper: {
    paddingVertical: 16,
  },
  warningCard: {
    flexShrink: 1,
    borderRadius: 8,
    backgroundColor: AlertUI.lightColor,
    borderWidth: 1,
    borderColor: AlertUI.baseHslColor.addLightness(4).toString(),
  },
  warningMessage: {
    fontSize: 14,
    color: AlertUI.darkColor,
    padding: 12,
  },
  formWrapper: {
    paddingBottom: 16,
  },
  input: {
    marginBottom: 24,
  },
});

export const CustomNetworkSettingsNav = Symbol('CustomNetworkSettings').toString();

export const CustomNetworkSettingsScreen = ({ navigation }) => {
  const dispatch = useDispatch();
  const networkSettings = useSelector((state) => state.networkSettings);
  const networkSettingsInvalid = useSelector((state) => state.networkSettingsInvalid);
  const networkSettingsStatus = useSelector((state) => state.networkSettingsStatus);
  // eslint-disable-next-line max-len
  const walletServiceEnabled = useSelector((state) => state.featureToggles[WALLET_SERVICE_FEATURE_TOGGLE]);

  const [formModel, setFormModel] = useState({
    nodeUrl: networkSettings.nodeUrl,
    explorerUrl: networkSettings.explorerUrl,
    explorerServiceUrl: networkSettings.explorerServiceUrl,
    txMiningServiceUrl: networkSettings.txMiningServiceUrl || '',
    walletServiceUrl: networkSettings.walletServiceUrl || '',
    walletServiceWsUrl: networkSettings.walletServiceWsUrl || '',
  });

  const [invalidModel, setInvalidModel] = useState({
    nodeUrl: networkSettingsInvalid?.nodeUrl || '',
    explorerUrl: networkSettingsInvalid?.explorerUrl || '',
    explorerServiceUrl: networkSettingsInvalid?.explorerServiceUrl || '',
    txMiningServiceUrl: networkSettingsInvalid.txMiningServiceUrl || '',
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
      txMiningServiceUrl: networkSettingsInvalid?.txMiningServiceUrl || '',
    });
  }, [networkSettingsInvalid]);

  useEffect(() => function cleanUp() {
    dispatch(networkSettingsUpdateInvalid({}));
  }, []);

  return (
    <KeyboardAvoidingView
      behavior='padding'
      style={styles.keyboardWrapper}
      keyboardVerticalOffset={48} /* some size for padding bottom on formWrapper */
    >
      <View style={styles.wrapper}>
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

        {hasSucceeded(networkSettingsStatus) && (
          <FeedbackModal
            icon={(<Image source={checkIcon} style={styles.feedbackModalIcon} resizeMode='contain' />)}
            text={feedbackSucceededText}
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

        <View style={[styles.container, styles.warningWrapper]}>
          <View style={styles.warningCard}>
            <Text style={styles.warningMessage}>{warningText}</Text>
          </View>
        </View>

        <ScrollView>
          <View style={[styles.container, styles.formWrapper]}>
            <SimpleInput
              keyboardType='url'
              containerStyle={styles.input}
              label={t`Node URL`}
              autoFocus
              onChangeText={handleInputChange('nodeUrl')}
              error={invalidModel.nodeUrl}
              value={formModel.nodeUrl}
            />

            <SimpleInput
              keyboardType='url'
              containerStyle={styles.input}
              label={t`Explorer URL`}
              onChangeText={handleInputChange('explorerUrl')}
              error={invalidModel.explorerUrl}
              value={formModel.explorerUrl}
            />

            <SimpleInput
              keyboardType='url'
              containerStyle={styles.input}
              label={t`Explorer Service URL`}
              onChangeText={handleInputChange('explorerServiceUrl')}
              error={invalidModel.explorerServiceUrl}
              value={formModel.explorerServiceUrl}
            />

            <SimpleInput
              keyboardType='url'
              containerStyle={styles.input}
              label={t`Transaction Mining Service URL`}
              onChangeText={handleInputChange('txMiningServiceUrl')}
              error={invalidModel.txMiningServiceUrl}
              value={formModel.txMiningServiceUrl}
            />

            {walletServiceEnabled && (
            <>
              <SimpleInput
                keyboardType='url'
                containerStyle={styles.input}
                label={t`Wallet Service URL (optional)`}
                onChangeText={handleInputChange('walletServiceUrl')}
                error={invalidModel.walletServiceUrl}
                value={formModel.walletServiceUrl}
              />

              <SimpleInput
                keyboardType='url'
                containerStyle={styles.input}
                label={t`Wallet Service WS URL (optional)`}
                onChangeText={handleInputChange('walletServiceWsUrl')}
                error={invalidModel.walletServiceWsUrl}
                value={formModel.walletServiceWsUrl}
              />
            </>
            )}

            <NewHathorButton
              disabled={hasError(invalidModel)}
              onPress={handleSubmit}
              title={t`Send`}
            />
          </View>
        </ScrollView>
      </View>
    </KeyboardAvoidingView>
  );
};
