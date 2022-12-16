import React from 'react';
import {
  StyleSheet,
  Text,
  ScrollView,
  SafeAreaView,
  Switch,
} from 'react-native';
import HathorHeader from '../components/HathorHeader';
import { HathorList, ListItem, ListMenu } from '../components/HathorList';

export default class PushNotification extends React.Component {
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
      // set default value for pushNotificationEnabled to false
      pushNotificationEnabled: false,
      // set default value for showAmountEnabled to false
      showAmountEnabled: false,
    };
  }

  // create componentDidMount method
  componentDidMount() {
    // set pushNotificationEnabled to true
    // this.setState({
    //   pushNotificationEnabled: true,
    // });
  }

  onPushNotificationSwitchChange = (value) => {
    // if first time enabling push notification, ask for consent on terms and conditions

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
