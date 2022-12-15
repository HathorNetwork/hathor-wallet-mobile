import React from 'react';
import {
  StyleSheet,
  Text,
  ScrollView,
  SafeAreaView,
} from 'react-native';
import HathorHeader from '../components/HathorHeader';

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
  });

  // create constructor
  constructor(props) {
    super(props);
    // set state
    this.state = {
      // set default value for pushNotificationEnabled to false
      pushNotificationEnabled: false,
    };
  }

  // create componentDidMount method
  componentDidMount() {
    // set pushNotificationEnabled to true
    this.setState({
      pushNotificationEnabled: true,
    });
  }

  // create render method
  render() {
    // return the following
    return (
      // return the following
      <SafeAreaView style={{ flex: 1, backgroundColor: '#F7F7F7' }}>
        <HathorHeader
          title='Push Notification'
          onBackPress={() => this.props.navigation.goBack()}
        />
        <ScrollView pinchGestureEnabled={false} contentContainerStyle={this.styles.view}>
          {/* return the following */}
          <Text style={this.styles.text}>
            {/* return the following */}
            {this.state.pushNotificationEnabled ? 'Push Notifications Enabled' : 'Push Notifications Disabled'}
          </Text>
        </ScrollView>
      </SafeAreaView>
    );
  }
}
