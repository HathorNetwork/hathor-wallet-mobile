import React from 'react';
import {
  StyleSheet,
  SafeAreaView,
  Switch,
} from 'react-native';
import { connect } from 'react-redux';
import HathorHeader from '../components/HathorHeader';
import { HathorList, ListItem } from '../components/HathorList';
import ActionModal from '../components/ActionModal';
import { isEnablingFeature } from '../utils';

/**
 * wallet {Object} wallet at user's device
 */
const mapInvoiceStateToProps = (state) => ({
  wallet: state.wallet,
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
      pushNotificationEnabled: false,
      showAmountEnabled: false,
      /**
       * hasPushNotificationBeenEnabled {boolean} if user has enabled push notification before
       * this is used to show the terms and conditions modal only the first time
       * user enables push notification
       */
      hasPushNotificationBeenEnabled: false,
      /**
       * modal {ActionModal.propTypes} action modal properties. If null, do not display
       */
      modal: null,
    };

    console.log('Wallet', this.props.wallet);
  }

  // create componentDidMount method
  componentDidMount() {
    // set pushNotificationEnabled to true
    // this.setState({
    //   pushNotificationEnabled: true,
    // });
  }

  onPushNotificationAgreement() {
    // call pushRegister from wallet-lib
    // hathorLib.wallet.PushNotification.pushRegister();

    this.setState({
      pushNotificationEnabled: true,
      hasPushNotificationBeenEnabled: false,
      modal: null
    });
  }

  onPushNotificationSwitchChange = (value) => {
    // if first time enabling push notification, ask for consent on terms and conditions
    if (isEnablingFeature(value) && !this.state.hasPushNotificationBeenEnabled) {
      this.setState({
        modal: {
          title: 'Push Notification',
          message: 'By enabling push notification, you agree to our terms and conditions.',
          button: 'I agree',
          onPress: () => this.onPushNotificationAgreement(),
          onDismiss: () => this.setState({ modal: null }),
        },
      });
      // exit method early
      return;
    }

    // if user is enabling push notification, ask for bio-metric confirmation

    // persist value

    this.setState({ pushNotificationEnabled: value });
  }

  onShowAmountSwitchChange = (value) => {
    this.setState({ showAmountEnabled: value });
  }


  // create render method
  render() {
    const isPushNotificationEnabled = this.state.pushNotificationEnabled;
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

        {this.state.modal && (
          <ActionModal
            title={this.state.modal.title}
            message={this.state.modal.message}
            button={this.state.modal.button}
            onPress={this.state.modal.onPress}
            onDismiss={() => this.setState({ modal: null })}
          />
        )}

        <HathorList>
          <ListItem
            title={pushNotificationEnabledText}
            titleStyle={this.state.pushNotificationEnabled ? this.styles.switchEnabled : null}
            text={(
              <Switch
                onValueChange={this.onPushNotificationSwitchChange}
                value={this.state.pushNotificationEnabled}
              />
            )}
            isFirst
          />
          <ListItem
            title={showAmountEnabledText}
            titleStyle={this.state.showAmountEnabled ? this.styles.switchEnabled : null}
            text={(
              <Switch
                onValueChange={this.onShowAmountSwitchChange}
                value={this.state.showAmountEnabled}
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
