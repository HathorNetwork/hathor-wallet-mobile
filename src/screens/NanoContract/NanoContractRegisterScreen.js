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
  Image,
} from 'react-native';
import {
  useDispatch,
  useSelector
} from 'react-redux';
import { t } from 'ttag';
import HathorHeader from '../../components/HathorHeader';
import NewHathorButton from '../../components/NewHathorButton';
import OfflineBar from '../../components/OfflineBar';
import SimpleInput from '../../components/SimpleInput';
import { COLORS } from '../../styles/themes';
import {
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

export function NanoContractRegisterScreen({ navigation, route }) {
  const ncIdFromQrCode = route.params?.ncId;

  const dispatch = useDispatch();
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
      dispatch(nanoContractRegisterRequest({ ncId }));
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
    if (ncIdFromQrCode) {
      // Set ncId in the input when given
      handleInputChange('ncId')(ncIdFromQrCode);
    }
  }, []);

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

        <ContentWrapper>
          <SimpleInput
            containerStyle={styles.input}
            label={t`Nano Contract ID`}
            autoFocus
            onChangeText={handleInputChange('ncId')}
            error={invalidModel.ncId}
            value={formModel.ncId}
          />
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
      <OfflineBar />
    </Wrapper>
  );
}

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
});
