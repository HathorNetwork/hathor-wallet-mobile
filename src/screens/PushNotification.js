import React from 'react';
import {
  StyleSheet,
  SafeAreaView,
  Switch,
  Image,
} from 'react-native';
import { connect } from 'react-redux';
import { PushNotification as PushNotificationFromLib } from '@hathor/wallet-lib';
import HathorHeader from '../components/HathorHeader';
import { HathorList, ListItem } from '../components/HathorList';
import ActionModal from '../components/ActionModal';
import { isEnablingFeature } from '../utils';
import FeedbackModal from '../components/FeedbackModal';
import errorIcon from '../assets/images/icErrorBig.png';
import { STORE } from '../constants';

/**
 * wallet {Object} wallet at user's device
 */
const mapInvoiceStateToProps = (state) => ({
  wallet: state.wallet,
  useWalletService: state.useWalletService,
  isShowingPinScreen: state.isShowingPinScreen,
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

  store = STORE;

  // create constructor
  constructor(props) {
    super(props);
    // set state
    this.state = {
      pushNotification: {
        enabled: false,
        /**
         * hasPushNotificationBeenEnabled {boolean} if user has enabled push notification before
         * this is used to show the terms and conditions modal only the first time
         * user enables push notification
         */
        hasBeenEnabled: false,
        showAmountEnabled: false,
      },
      /**
       * actionModal {ActionModal.propTypes} action modal properties. If null, do not display
       */
      actionModal: null,
      /**
       * feedbackModal {Feedback.propTypes} feedback modal properties. If null, do not display
       */
      feedbackModal: null,
    };
  }

  // create componentDidMount method
  componentDidMount() {
    // set pushNotificationEnabled to true
    this.setState({
      pushNotification: {
        ...this.state.pushNotification,
        enabled: this.store.getItem(pushNotificationKey.enabled),
        hasBeenEnabled: this.store.getItem(pushNotificationKey.hasBeenEnabled),
        showAmountEnabled: this.store.getItem(pushNotificationKey.showAmountEnabled),
      }
    });
  }

  isFirstTimeEnablingPushNotification(value) {
    return isEnablingFeature(value) && !this.state.pushNotification.hasBeenEnabled;
  }

  dismissActionModal() {
    this.setState({ actionModal: null });
  }

  dismissFeedbackModal() {
    this.setState({ feedbackModal: null });
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

  async executeFirstRegistrationOnPushNotification(pin) {
    // NOTE: this wallet needs to be the wallet without web socket connection

    const { success } = PushNotificationFromLib.registerDevice(this.props.wallet, { token: '123' });
    if (success) {
      this.setState({
        pushNotification: {
          ...this.state.pushNotification,
          enabled: true,
          hasBeenEnabled: true,
        }
      });
      this.persistPushNotificationSettings();
    } else {
      this.setState({
        feedbackModal: {
          icon: <Image source={errorIcon} style={{ height: 105, width: 105 }} resizeMode='contain' />,
          text: 'There was an error enabling push notification. Please try again later.',
          onDismiss: () => this.dismissFeedbackModal(),
        },
      });
    }
  }

  /**
   * Called when user agrees to push notification terms and conditions,
   * so we need to confirm the pin to start the registration process.
   */
  onPushNotificationAgreement() {
    this.dismissActionModal();

    const params = {
      cb: () => this.executeFirstRegistrationOnPushNotification(),
      screenText: 'Enter your 6-digit pin to confirm registration of your device',
      biometryText: 'Authorize device registration to push notification',
      canCancel: true,
    };
    this.props.navigation.navigate('PinScreen', params);
  }

  onPushNotificationSwitchChange = (value) => {
    if (this.isFirstTimeEnablingPushNotification(value)) {
      this.actionOnTermsAndConditions();
      return;
    }

    this.executeUpdateOnPushNotification(value);
  }

  onShowAmountSwitchChange = (value) => {
    this.setState({ pushNotification: { ...this.state.pushNotification, showAmountEnabled: value } });
    this.persistPushNotificationSettings();
  }

  // create render method
  render() {
    const isPushNotificationEnabled = this.state.pushNotification.enabled;
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

        {this.state.feedbackModal && (
          <FeedbackModal
            icon={this.state.feedbackModal.icon}
            text={this.state.feedbackModal.text}
            onDismiss={this.state.feedbackModal.onDismiss}
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
                value={this.state.pushNotification.enabled}
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
                value={this.state.pushNotification.showAmountEnabled}
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

export default connect(mapInvoiceStateToProps)(PushNotification);
