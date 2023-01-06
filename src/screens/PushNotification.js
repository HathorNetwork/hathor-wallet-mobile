import React from 'react';
import {
  StyleSheet,
  SafeAreaView,
  Switch,
  Image,
} from 'react-native';
import { connect } from 'react-redux';
import { isEqual } from 'lodash';
import { t } from 'ttag';
import HathorHeader from '../components/HathorHeader';
import { HathorList, ListItem } from '../components/HathorList';
import ActionModal from '../components/ActionModal';
import { isEnablingFeature } from '../utils';
import FeedbackModal from '../components/FeedbackModal';
import errorIcon from '../assets/images/icErrorBig.png';
import { STORE, pushNotificationKey } from '../constants';
import { pushApiReady, pushFirstTimeRegistration, pushUpdateRequested } from '../actions';
import { PUSH_API_STATUS } from '../sagas/pushNotification';

const getPushNotificationSettings = (pushNotification) => {
  const { enabled, showAmountEnabled } = pushNotification;
  return {
    enabled,
    showAmountEnabled
  };
};

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

class PushNotification extends React.Component {
  styles = StyleSheet.create({
    view: {
      padding: 16,
      justifyContent: 'space-between',
      flexGrow: 1,
    },
    text: {
      fontSize: 16,
      fontWeight: 'bold',
    },
    switchEnabled: {
      color: 'black',
    },
  });

  // create constructor
  constructor(props) {
    super(props);

    // set state
    this.state = {
      /**
       * actionModal {ActionModal.propTypes} action modal properties. If null, do not display
       */
      actionModal: null,
    };
  }

  componentDidUpdate(prevProps) {
    const oldSettings = getPushNotificationSettings(prevProps.pushNotification);
    const currSettings = getPushNotificationSettings(this.props.pushNotification);
    if (!isEqual(oldSettings, currSettings)) {
      STORE.setItem(pushNotificationKey.settings, currSettings);
    }
  }

  isFirstTimeEnablingPushNotification(value) {
    return isEnablingFeature(value) && !this.props.pushNotification.hasBeenEnabled;
  }

  dismissActionModal() {
    this.setState({ actionModal: null });
  }

  dismissFeedbackModal() {
    this.props.pushApiReady();
  }

  onPushNotificationSwitchChange = (value) => {
    if (this.isFirstTimeEnablingPushNotification(value)) {
      this.actionOnTermsAndConditions();
      return;
    }

    this.executeUpdateOnPushNotification(value);
  }

  actionOnTermsAndConditions = () => {
    this.setState({
      actionModal: {
        title: 'Push Notification',
        message: 'By enabling push notification, you agree to our terms and conditions.',
        button: 'I agree',
        onAction: () => this.executeFirstRegistrationOnPushNotification(),
        onDismiss: () => this.dismissActionModal(),
      },
    });
  }

  /**
   * @param {boolean} enabled as the new value of the switch
   */
  executeUpdateOnPushNotification = (enabled) => {
    const settings = {
      ...getPushNotificationSettings(this.props.pushNotification),
      enabled,
      deviceId: this.props.pushNotification.deviceId,
    };
    this.props.pushUpdateRequested(settings);
  }

  async executeFirstRegistrationOnPushNotification() {
    this.dismissActionModal();
    this.props.pushFirstTimeRegistration(this.props.pushNotification.deviceId);
  }

  onShowAmountSwitchChange = (showAmountEnabled) => {
    const settings = {
      ...getPushNotificationSettings(this.props.pushNotification),
      showAmountEnabled,
      deviceId: this.props.pushNotification.deviceId,
    };
    console.log('settings', settings);
    this.props.pushUpdateRequested(settings);
  }

  // create render method
  render() {
    const isPushNotificationEnabled = this.props.pushNotification.enabled;
    const { showAmountEnabled, hasPushApiFailed } = this.props.pushNotification;
    const pushNotificationEnabledText = t`Enable Push Notification`;
    const showAmountEnabledText = t`Show amounts on notification`;

    // return the following
    return (
      // return the following
      <SafeAreaView style={{ flex: 1, backgroundColor: '#F7F7F7' }}>
        <HathorHeader
          title={t`Push Notification`}
          onBackPress={() => this.props.navigation.goBack()}
        />

        {hasPushApiFailed && (
          <FeedbackModal
            icon={(<Image source={errorIcon} style={{ height: 105, width: 105 }} resizeMode='contain' />)}
            text={t`There was an error enabling push notification. Please try again later.`}
            onDismiss={() => this.dismissFeedbackModal()}
          />
        )}

        {this.state.actionModal && (
          <ActionModal
            title={this.state.actionModal.title}
            message={this.state.actionModal.message}
            button={this.state.actionModal.button}
            onAction={this.state.actionModal.onAction}
            onDismiss={this.state.actionModal.onDismiss}
          />
        )}

        <HathorList>
          <ListItem
            title={pushNotificationEnabledText}
            titleStyle={this.styles.switchEnabled}
            text={(
              <Switch
                onValueChange={this.onPushNotificationSwitchChange}
                value={isPushNotificationEnabled}
              />
            )}
            isFirst
          />
          <ListItem
            title={showAmountEnabledText}
            titleStyle={isPushNotificationEnabled ? this.styles.switchEnabled : null}
            text={(
              <Switch
                onValueChange={this.onShowAmountSwitchChange}
                value={showAmountEnabled}
                disabled={!isPushNotificationEnabled}
              />
            )}
            isLast
          />
        </HathorList>
      </SafeAreaView>
    );
  }
}

export default connect(mapPushNotificationStateToProps, mapPushNotificationDispatchToProps)(PushNotification);
