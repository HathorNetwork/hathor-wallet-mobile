import React from 'react';
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
import { isEnablingFeature } from '../utils';
import FeedbackModal from '../components/FeedbackModal';
import errorIcon from '../assets/images/icErrorBig.png';
import { pushApiReady, pushFirstTimeRegistration, pushUpdateRequested } from '../actions';
import { PUSH_API_STATUS } from '../sagas/pushNotification';
import Spinner from '../components/Spinner';

const isApiStatusLoading = (state) => {
  return !state.isShowingPinScreen && state.pushNotification.apiStatus === PUSH_API_STATUS.LOADING;
};

const hasApiStatusFailed = (pushNotification) => {
  return pushNotification.apiStatus === PUSH_API_STATUS.FAILED;
};

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
const apiRequestLoadingText = t`Updating push notification...`;
const apiRequestFailedText = t`There was an error enabling push notification. Please try again later.`;

export default function PushNotification(props) {
  const {
    enabled,
    showAmountEnabled,
    deviceId,
    hasBeenEnabled,
  } = useSelector((state) => state.pushNotification);
  const isPushApiLoading = useSelector((state) => isApiStatusLoading(state));
  const hasPushApiFailed = useSelector((state) => hasApiStatusFailed(state.pushNotification));
  const dispatch = useDispatch();

  const onPushNotificationSwitchChange = (value) => {
    const isFirstTime = isEnablingFeature(value) && !hasBeenEnabled;
    if (isFirstTime) {
      executeFirstRegistrationOnPushNotification();
      return;
    }

    executeUpdateOnPushNotification(value);
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

      {isPushApiLoading && (
        <FeedbackModal
          icon={<Spinner />}
          text={apiRequestLoadingText}
        />
      )}

      {hasPushApiFailed && (
        <FeedbackModal
          icon={(<Image source={errorIcon} style={styles.feedbackModalIcon} resizeMode='contain' />)}
          text={apiRequestFailedText}
          onDismiss={() => dispatch(pushApiReady())}
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
