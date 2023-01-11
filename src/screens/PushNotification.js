import React, { useEffect, useState } from 'react';
import {
  StyleSheet,
  SafeAreaView,
  Switch,
  Image,
} from 'react-native';
import { connect } from 'react-redux';
import { t } from 'ttag';
import HathorHeader from '../components/HathorHeader';
import { HathorList, ListItem } from '../components/HathorList';
import ActionModal from '../components/ActionModal';
import { isEnablingFeature, getPushNotificationSettings } from '../utils';
import FeedbackModal from '../components/FeedbackModal';
import errorIcon from '../assets/images/icErrorBig.png';
import { STORE, pushNotificationKey } from '../constants';
import { pushApiReady, pushFirstTimeRegistration, pushUpdateRequested } from '../actions';
import { PUSH_API_STATUS } from '../sagas/pushNotification';


// eslint-disable-next-line max-len
const hasApiStatusFailed = (pushNotification) => pushNotification.apiStatus === PUSH_API_STATUS.FAILED;

/**
 * wallet {Object} wallet at user's device
 */
const mapPushNotificationStateToProps = (state) => ({
  wallet: state.wallet,
  pushNotification: {
    ...state.pushNotification,
    ...(state.pushNotification.noChange && STORE.getItem(pushNotificationKey.settings)),
    hasPushApiFailed: hasApiStatusFailed(state.pushNotification),
  },
});

const mapPushNotificationDispatchToProps = (dispatch) => ({
  pushApiReady: () => dispatch(pushApiReady()),
  pushFirstTimeRegistration: (deviceId) => dispatch(pushFirstTimeRegistration({ deviceId })),
  pushUpdateRequested: (settings) => dispatch(pushUpdateRequested(settings)),
});

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

function PushNotification(props) {
  /**
   * actionModal {ActionModal.propTypes} action modal properties. If null, do not display
   */
  const [actionModal, setActionModal] = useState(null);
  const [
    {
      enabled: isEnabled,
      showAmountEnabled,
      hasPushApiFailed
    },
    setSettings
  ] = useState(props.pushNotification);

  useEffect(() => {
    setSettings(props.pushNotification);
  });

  const isFirstTimeEnablingPushNotification = (value) => {
    return isEnablingFeature(value) && !props.pushNotification.hasBeenEnabled;
  };

  const dismissActionModal = () => {
    setActionModal(null);
  };

  const dismissFeedbackModal = () => {
    props.pushApiReady();
  };

  const onPushNotificationSwitchChange = (value) => {
    if (isFirstTimeEnablingPushNotification(value)) {
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
      ...getPushNotificationSettings(props.pushNotification),
      enabled,
      deviceId: props.pushNotification.deviceId,
    };
    props.pushUpdateRequested(settings);
  };

  const executeFirstRegistrationOnPushNotification = async () => {
    dismissActionModal();
    props.pushFirstTimeRegistration(props.pushNotification.deviceId);
  };

  const onShowAmountSwitchChange = (showAmountEnabled) => {
    const settings = {
      ...getPushNotificationSettings(props.pushNotification),
      showAmountEnabled,
      deviceId: props.pushNotification.deviceId,
    };
    props.pushUpdateRequested(settings);
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
          onDismiss={() => dismissFeedbackModal()}
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
              value={isEnabled}
            />
          )}
          isFirst
        />
        <ListItem
          title={showAmountsOnNotificationText}
          titleStyle={isEnabled ? styles.switchEnabled : null}
          text={(
            <Switch
              onValueChange={onShowAmountSwitchChange}
              value={showAmountEnabled}
              disabled={!isEnabled}
            />
          )}
          isLast
        />
      </HathorList>
    </SafeAreaView>
  );
}

export default connect(mapPushNotificationStateToProps, mapPushNotificationDispatchToProps)(PushNotification);
