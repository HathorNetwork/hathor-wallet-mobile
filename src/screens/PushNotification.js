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
import FeedbackModal from '../components/FeedbackModal';
import errorIcon from '../assets/images/icErrorBig.png';
import { pushApiReady, pushRegistrationRequested } from '../actions';
import Spinner from '../components/Spinner';
import { PUSH_API_STATUS } from '../constants';

/**
 * Check if the api status is loading and if the pin screen is not showing.
 * @param {store} state - redux store
 * @returns {boolean} - true if the api status is loading and the pin screen is not showing,
 * false otherwise
 */
const isApiStatusLoading = (state) => {
  const isApiLoading = state.pushNotification.apiStatus === PUSH_API_STATUS.LOADING;
  return !state.isShowingPinScreen && isApiLoading;
};

/**
 * Check if the api status is failed
 * @param {object} pushNotification - pushNotification object from redux store
 * @returns {boolean} - true if the api status is failed, false otherwise
 */
const hasApiStatusFailed = (pushNotification) => {
  const hasApiFailed = pushNotification.apiStatus === PUSH_API_STATUS.FAILED;
  return hasApiFailed;
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

/**
 * Component that shows the push notification settings as a page.
 * @param {Object} props.navigation - navigation object from react-navigation
 * @returns {React.Component} - React component with the push notification settings
 */
export default function PushNotification(props) {
  const {
    enabled,
    showAmountEnabled,
    deviceId,
  } = useSelector((state) => state.pushNotification);
  const isPushApiLoading = useSelector((state) => isApiStatusLoading(state));
  const hasPushApiFailed = useSelector((state) => hasApiStatusFailed(state.pushNotification));
  const dispatch = useDispatch();

  const onEnableSwitchChange = (enabled) => {
    dispatch(pushRegistrationRequested({ enabled, showAmountEnabled, deviceId }));
  };

  const onShowAmountSwitchChange = (showAmountEnabled) => {
    dispatch(pushRegistrationRequested({ enabled, showAmountEnabled, deviceId }));
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
              onValueChange={onEnableSwitchChange}
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
