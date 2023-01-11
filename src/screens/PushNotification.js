import React, { useState } from 'react';
import {
  StyleSheet,
  SafeAreaView,
  Switch,
  Image,
} from 'react-native';
import { useDispatch, useSelector } from 'react-redux';
import { t } from 'ttag';
import HathorHeader from '../components/HathorHeader';
import { HathorList, ListItem } from '../components/HathorList';
import ActionModal from '../components/ActionModal';
import { isEnablingFeature } from '../utils';
import FeedbackModal from '../components/FeedbackModal';
import errorIcon from '../assets/images/icErrorBig.png';
import { pushApiReady, pushFirstTimeRegistration, pushUpdateRequested } from '../actions';
import { PUSH_API_STATUS } from '../sagas/pushNotification';


// eslint-disable-next-line max-len
const hasApiStatusFailed = (pushNotification) => pushNotification.apiStatus === PUSH_API_STATUS.FAILED;

const styles = StyleSheet.create({
  view: {
    flex: 1,
    backgroundColor: '#F7F7F7',
  },
  feedbackModalIcon: {
    height: 105,
    width: 105
  },
  text: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  switchEnabled: {
    color: 'black',
  },
});

const pageTitleText = t`Push Notification`;
const enablePushNotificationText = t`Enable Push Notification`;
const showAmountsOnNotificationText = t`Show amounts on notification`;
const apiRequestFailedText = t`There was an error enabling push notification. Please try again later.`;
const termsAndConditionsModalTitleText = t`Push Notification`;
const termsAndConditionsModalMessageText = t`By enabling push notification, you agree to our terms and conditions.`;
const termsAndConditionsModalActionButtonText = t`I agree`;

export default function PushNotification(props) {
  const {
    enabled,
    showAmountEnabled,
    deviceId,
    hasBeenEnabled,
  } = useSelector((state) => state.pushNotification);
  const hasPushApiFailed = useSelector((state) => hasApiStatusFailed(state.pushNotification));
  const dispatch = useDispatch();

  /**
   * actionModal {ActionModal.propTypes} action modal properties. If null, do not display
   */
  const [actionModal, setActionModal] = useState(null);

  const dismissActionModal = () => {
    setActionModal(null);
  };

  const onPushNotificationSwitchChange = (value) => {
    const isFirstTime = isEnablingFeature(value) && !hasBeenEnabled;
    if (isFirstTime) {
      actionOnTermsAndConditions();
      return;
    }

    executeUpdateOnPushNotification(value);
  };

  const actionOnTermsAndConditions = () => {
    setActionModal({
      title: termsAndConditionsModalTitleText,
      message: termsAndConditionsModalMessageText,
      button: termsAndConditionsModalActionButtonText,
      onAction: () => executeFirstRegistrationOnPushNotification(),
      onDismiss: () => dismissActionModal(),
    });
  };

  /**
   * @param {boolean} enabled as the new value of the switch
   */
  const executeUpdateOnPushNotification = (enabled) => {
    const settings = {
      deviceId,
      enabled,
      showAmountEnabled,
    };
    dispatch(pushUpdateRequested(settings));
  };

  const executeFirstRegistrationOnPushNotification = async () => {
    dismissActionModal();
    dispatch(pushFirstTimeRegistration({ deviceId }));
  };

  const onShowAmountSwitchChange = (showAmountEnabled) => {
    const settings = {
      deviceId,
      enabled,
      showAmountEnabled,
    };
    dispatch(pushUpdateRequested(settings));
  };

  return (
    <SafeAreaView style={styles.view}>
      <HathorHeader
        title={pageTitleText}
        onBackPress={() => props.navigation.goBack()}
      />

      {hasPushApiFailed && (
        <FeedbackModal
          icon={(<Image source={errorIcon} style={styles.feedbackModalIcon} resizeMode='contain' />)}
          text={apiRequestFailedText}
          onDismiss={() => dispatch(pushApiReady())}
        />
      )}

      {actionModal && (
        <ActionModal
          title={actionModal.title}
          message={actionModal.message}
          button={actionModal.button}
          onAction={actionModal.onAction}
          onDismiss={actionModal.onDismiss}
        />
      )}

      <HathorList>
        <ListItem
          title={enablePushNotificationText}
          titleStyle={styles.switchEnabled}
          text={(
            <Switch
              onValueChange={onPushNotificationSwitchChange}
              value={enabled}
            />
          )}
          isFirst
        />
        <ListItem
          title={showAmountsOnNotificationText}
          titleStyle={enabled ? styles.switchEnabled : null}
          text={(
            <Switch
              onValueChange={onShowAmountSwitchChange}
              value={showAmountEnabled}
              disabled={!enabled}
            />
          )}
          isLast
        />
      </HathorList>
    </SafeAreaView>
  );
}
