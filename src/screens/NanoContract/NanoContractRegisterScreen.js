/**
 * Copyright (c) Hathor Labs and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import React, {
  useEffect,
  useState,
  useCallback
} from 'react';
import {
  StyleSheet,
  View,
  Text,
  Image,
} from 'react-native';
import {
  useDispatch,
  useSelector
} from 'react-redux';
import { t } from 'ttag';
import HathorHeader from '../../components/HathorHeader';
import { CircleInfoIcon } from '../../components/Icons/CircleInfo.icon';
import NewHathorButton from '../../components/NewHathorButton';
import OfflineBar from '../../components/OfflineBar';
import SimpleInput from '../../components/SimpleInput';
import { TextLabel } from '../../components/TextLabel';
import { TextValue } from '../../components/TextValue';
import { COLORS } from '../../styles/themes';
import {
  firstAddressRequest,
  nanoContractRegisterReady,
  nanoContractRegisterRequest
} from '../../actions';
import {
  feedbackSucceedText,
  hasFailed,
  hasSucceeded,
  isLoading
} from './helper';
import Spinner from '../../components/Spinner';
import FeedbackModal from '../../components/FeedbackModal';
import errorIcon from '../../assets/images/icErrorBig.png';
import checkIcon from '../../assets/images/icCheckBig.png';
import { FeedbackContent } from '../../components/FeedbackContent';
import { hasError } from '../../utils';

/**
 * Validates the formModel, returning the invalidModel.
 * If there is no error in the formModel, the invalidModel is returned empty.
 */
function validate(formModel) {
  const invalidModel = {};

  if (!formModel.ncId) {
    invalidModel.ncId = t`Nano Contract ID is required.`;
  }

  return invalidModel;
}

export function NanoContractRegisterScreen({ navigation }) {
  const dispatch = useDispatch();
  const { address, error } = useSelector((state) => state.firstAddress);
  const registerState = useSelector((state) => ({
    registerStatus: state.nanoContract.registerStatus,
    registerFailureMessage: state.nanoContract.registerFailureMessage,
  }));

  const [isClean, setClean] = useState(true);
  const [formModel, setFormModel] = useState({
    ncId: null,
  });
  const [invalidModel, setInvalidModel] = useState({
    ncId: null,
  });

  /**
   * It handles input change to perform validations.
   * @param { ((name: 'ncId') => (value: string) => {}) => {} }
   */
  const handleInputChange = useCallback(
    (name) => (value) => {
      if (isClean) {
        setClean(false);
      }

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
    },
    [isClean, invalidModel, formModel]
  );

  const handleSubmit = useCallback(
    () => {
      const newInvalidModel = validate(formModel);
      if (hasError(newInvalidModel)) {
        setInvalidModel(newInvalidModel);
        return;
      }

      const { ncId } = formModel;
      dispatch(nanoContractRegisterRequest({ address, ncId }));
    },
    [formModel]
  );

  const handleFeedbackModalDismiss = () => {
    dispatch(nanoContractRegisterReady());
  };

  const navigatesToNanoContractTransactions = () => {
    dispatch(nanoContractRegisterReady());
    navigation.replace('NanoContractDetailsScreen', { ncId: formModel.ncId });
  };

  useEffect(() => {
    if (!address) {
      dispatch(firstAddressRequest());
    }
  }, []);

  const hasFirstAddressFailed = () => error;
  const isFirstAddressLoading = () => !error && !address;
  const hasFirstAddressLoaded = () => !error && address;

  return (
    <Wrapper>
      <NavigationHeader navigation={navigation} />

      {hasSucceeded(registerState.registerStatus)
        && (
          <FeedbackModal
            icon={(<Image source={checkIcon} style={styles.feedbackModalIcon} resizeMode='contain' />)}
            text={feedbackSucceedText}
            onDismiss={handleFeedbackModalDismiss}
            action={(<NewHathorButton discrete title={t`See contract`} onPress={navigatesToNanoContractTransactions} />)}
          />
        )}

      {hasFailed(registerState.registerStatus)
        && (
          <FeedbackModal
            icon={(<Image source={errorIcon} style={styles.feedbackModalIcon} resizeMode='contain' />)}
            text={registerState.registerFailureMessage}
            onDismiss={handleFeedbackModalDismiss}
            action={(<NewHathorButton discrete title={t`Try again`} onPress={handleSubmit} />)}
          />
        )}

      {hasFirstAddressFailed()
        && (
        <FeedbackContent
          icon={(<Image source={errorIcon} style={styles.feedbackContentIcon} resizeMode='contain' />)}
          title={t`Load First Addresses Error`}
          message={error}
        />
        )}

      {isFirstAddressLoading()
        && (
        <FeedbackContent
          title={t`Loading`}
          message={t`Loading first wallet address.`}
        />
        )}

      {hasFirstAddressLoaded()
        && (
        <ContentWrapper>
          <SimpleInput
            containerStyle={styles.input}
            label={t`Nano Contract ID`}
            autoFocus
            onChangeText={handleInputChange('ncId')}
            error={invalidModel.ncId}
            value={formModel.ncId}
          />
          <View style={styles.selectionContainer}>
            <FieldContainer>
              <TextLabel pb8 bold>{t`Wallet Address`}</TextLabel>
              <TextValue>{address}</TextValue>
            </FieldContainer>
          </View>
          <View style={styles.infoContainer}>
            <View style={styles.infoIcon}>
              <CircleInfoIcon size={20} color='hsla(203, 100%, 25%, 1)' />
            </View>
            <View style={styles.infoContent}>
              <Text style={styles.text}>
                {t`If you want to change the wallet address, you will be able to do`}
                <Text style={styles.bold}>
                  {' '}{t`after the contract is registered.`}
                </Text>
              </Text>
            </View>
          </View>
          {isLoading(registerState.registerStatus)
            && (
              <View style={styles.loadingContainer}>
                <Spinner size={24} />
              </View>
            )}
          <View style={styles.buttonContainer}>
            <NewHathorButton
              disabled={(
                hasError(invalidModel)
                  || isClean
                  || isLoading(registerState.registerStatus)
              )}
              onPress={handleSubmit}
              title={t`Register Nano Contract`}
            />
          </View>
        </ContentWrapper>
        )}
      <OfflineBar />
    </Wrapper>
  );
}

const FieldContainer = ({ last, children }) => (
  <View style={[styles.fieldContainer, last && styles.pd0]}>
    {children}
  </View>
);

const NavigationHeader = ({ navigation }) => (
  <HathorHeader
    title={t`Nano Contract Registration`.toUpperCase()}
    onBackPress={() => navigation.goBack()}
  />
);

const Wrapper = ({ children }) => (
  <View style={styles.wrapper}>
    {children}
  </View>
);

const ContentWrapper = ({ children }) => (
  <View style={styles.contentWrapper}>
    {children}
  </View>
);

const styles = StyleSheet.create({
  wrapper: {
    flex: 1,
    justifyContent: 'flex-start',
    alignSelf: 'stretch',
    backgroundColor: COLORS.lowContrastDetail, // Defines an outer area on the main list content
  },
  contentWrapper: {
    flex: 1,
    alignSelf: 'stretch',
    paddingTop: 16,
    paddingBottom: 48,
    paddingHorizontal: 16,
  },
  infoContainer: {
    flexShrink: 1,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 24,
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 16,
    backgroundColor: 'hsla(203, 100%, 93%, 1)',
  },
  infoContent: {
    flex: 1,
    paddingLeft: 8,
  },
  selectionContainer: {
    marginBottom: 16,
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 16,
    backgroundColor: COLORS.freeze100,
  },
  loadingContainer: {
    alignItems: 'center',
  },
  input: {
    marginBottom: 24,
  },
  buttonContainer: {
    alignSelf: 'stretch',
    marginTop: 'auto',
  },
  feedbackModalIcon: {
    height: 105,
    width: 105
  },
  feedbackContentIcon: {
    height: 36,
    width: 36,
  },
  text: {
    fontSize: 14,
    lineHeight: 20,
  },
  bold: {
    fontWeight: 'bold',
  },
  pd0: {
    paddingBottom: 0,
  },
  pd8: {
    paddingBottom: 8,
  },
});
