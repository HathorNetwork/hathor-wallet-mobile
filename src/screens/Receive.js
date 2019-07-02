import React from 'react';
import {
  Dimensions, Keyboard, SafeAreaView, View,
} from 'react-native';

import { TabBar, TabView } from 'react-native-tab-view';
import HathorHeader from '../components/HathorHeader';
import ReceiveMyAddress from '../components/ReceiveMyAddress';
import NewPaymentRequest from '../components/NewPaymentRequest';
import OfflineBar from '../components/OfflineBar';

class ReceiveScreen extends React.Component {
  constructor(props) {
    super(props);
    /**
     * address {string} Address selected to receive the payment
     * index {number} Selected index of the tab bar
     * routes {Array} Array of objects that stores each tab bar option {key, title}
     */
    this.state = {
      address: '',
      index: 0,
      routes: [
        { key: 'address', title: 'My Address' },
        { key: 'paymentRequest', title: 'Payment Request' },
      ],
    };

    // Reference to payment request component
    this.paymentRequest = React.createRef();
  }

  onAddressUpdate = (address) => {
    this.setState({ address });
  }

  onActivateRight = () => {
    if (this.paymentRequest.current) {
      this.paymentRequest.current.focus();
    }
  }

  onActivateLeft = () => {
    Keyboard.dismiss();
  }

  renderScene = ({ route }) => {
    switch (route.key) {
      case 'address':
        return (
          <ReceiveMyAddress
            navigation={this.props.navigation}
            onAddressUpdate={this.onAddressUpdate}
          />
        );
      case 'paymentRequest':
        return (
          <NewPaymentRequest
            navigation={this.props.navigation}
            address={this.state.address}
            index={this.state.index}
            ref={this.paymentRequest}
          />
        );
      default:
        return null;
    }
  };

  getLabelText = ({ route }) => {
    // Need to set this method because the default method set the title to uppercase
    switch (route.key) {
      case 'address':
        return route.title;
      case 'paymentRequest':
        return route.title;
      default:
        return null;
    }
  }

  handleIndexChange = (index) => {
    this.setState({ index }, () => {
      if (index === 0) {
        this.onActivateLeft();
      } else {
        this.onActivateRight();
      }
    });
  }

  render() {
    const renderTabBar = props => (
      <TabBar
        {...props}
        indicatorStyle={{ backgroundColor: '#333' }}
        style={{ backgroundColor: '#fff' }}
        labelStyle={{ color: '#333' }}
        getLabelText={this.getLabelText}
      />
    );

    return (
      <SafeAreaView style={{ flex: 1 }}>
        <HathorHeader title="RECEIVE" />
        <TabView
          renderTabBar={props => renderTabBar(props)}
          navigationState={this.state}
          renderScene={this.renderScene}
          onIndexChange={this.handleIndexChange}
          initialLayout={{ width: Dimensions.get('window').width }}
        />
        <OfflineBar />
      </SafeAreaView>
    );
  }
}

export default ReceiveScreen;
