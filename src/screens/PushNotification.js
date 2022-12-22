import React from 'react';
import {
  StyleSheet,
  SafeAreaView,
  Switch,
  Image,
} from 'react-native';
import { connect } from 'react-redux';
import { isEqual } from 'lodash';
import HathorHeader from '../components/HathorHeader';
import { HathorList, ListItem } from '../components/HathorList';
import ActionModal from '../components/ActionModal';
import { isEnablingFeature } from '../utils';
import FeedbackModal from '../components/FeedbackModal';
import errorIcon from '../assets/images/icErrorBig.png';
import { STORE } from '../constants';
import { pushApiReady, pushFirstTimeRegistration, pushUpdateRequested } from '../actions';
import { PUSH_API_STATUS } from '../sagas/pushNotification';

const pushNotificationKey = {
  settings: 'pushNotification:settings',
  hasBeenEnabled: 'pushNotification:hasBeenEnabled',
};

const getPushNotificationSettings = (pushNotification) => {
  const { enabled, showAmountEnabled } = pushNotification;
  return {
    enabled,
    showAmountEnabled
  };
};

const hasApiStatusFailed = (pushNotification) => pushNotification.apiStatus === PUSH_API_STATUS.FAILED;

/**
 * wallet {Object} wallet at user's device
 */
const mapInvoiceStateToProps = (state) => ({
  wallet: state.wallet,
  pushNotification: {
    ...state.pushNotification,
    ...(state.pushNotification.noChange && STORE.getItem(pushNotificationKey.settings)),
    hasBeenEnabled: STORE.getItem(pushNotificationKey.hasBeenEnabled),
    hasPushApiFailed: hasApiStatusFailed(state.pushNotification),
  },
});

const mapInvoiceDispatchToProps = (dispatch) => ({
  pushApiReady: () => dispatch(pushApiReady()),
  pushFirstTimeRegistration: (deviceId, xpub) => dispatch(pushFirstTimeRegistration({ deviceId, xpub })),
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

    const oldHasBeenEnabled = prevProps.pushNotification.hasBeenEnabled;
    const currHasBeenEnabled = this.props.pushNotification.hasBeenEnabled;
    if (oldHasBeenEnabled !== currHasBeenEnabled) {
      STORE.setItem(pushNotificationKey.hasBeenEnabled, currHasBeenEnabled);
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
        onAction: () => this.onPushNotificationAgreement(),
        onDismiss: () => this.dismissActionModal(),
      },
    });
  }

  /**
   * @param {boolean} value as the new value of the switch
   */
  executeUpdateOnPushNotification = (value) => {
    const settings = {
      ...getPushNotificationSettings(this.props.pushNotification),
      enabled: value,
    };
    this.props.pushUpdateRequested(settings);
  }

  /**
   * Called when user agrees to push notification terms and conditions,
   * so we need to confirm the pin to start the registration process.
   */
  onPushNotificationAgreement = () => {
    this.dismissActionModal();

    const params = {
      cb: () => this.executeFirstRegistrationOnPushNotification(),
      screenText: 'Enter your 6-digit pin to confirm registration of your device',
      biometryText: 'Authorize device registration to push notification',
      canCancel: true,
    };
    this.props.navigation.navigate('PinScreen', params);
  }

  async executeFirstRegistrationOnPushNotification(pin) {
    // NOTE: this wallet needs to be the wallet without web socket connection
    this.props.pushFirstTimeRegistration({ deviceId: 'deviceId', xpub: 'walletXpub' });
  }

  onShowAmountSwitchChange = (value) => {
    const settings = {
      ...getPushNotificationSettings(this.props.pushNotification),
      showAmountEnabled: value,
    };
    this.props.pushUpdateRequested(settings);
  }

  // create render method
  render() {
    const isPushNotificationEnabled = this.props.pushNotification.enabled;
    const { showAmountEnabled, hasPushApiFailed } = this.props.pushNotification;
    const pushNotificationEnabledText = 'Enable Push Notification';
    const showAmountEnabledText = 'Show amounts on notification';

    // return the following
    return (
      // return the following
      <SafeAreaView style={{ flex: 1, backgroundColor: '#F7F7F7' }}>
        <HathorHeader
          title='Push Notification'
          onBackPress={() => this.props.navigation.goBack()}
        />

        {hasPushApiFailed && (
          <FeedbackModal
            icon={(<Image source={errorIcon} style={{ height: 105, width: 105 }} resizeMode='contain' />)}
            text='There was an error enabling push notification. Please try again later.'
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

export default connect(mapInvoiceStateToProps, mapInvoiceDispatchToProps)(PushNotification);
