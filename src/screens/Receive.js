/**
 * Copyright (c) Hathor Labs and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import React from 'react';
import { Dimensions, Keyboard, Pressable, View } from 'react-native';
import { t } from 'ttag';

import { TabBar, TabView } from 'react-native-tab-view';
import HathorHeader from '../components/HathorHeader';
import ReceiveMyAddress from '../components/ReceiveMyAddress';
import NewPaymentRequest from '../components/NewPaymentRequest';
import OfflineBar from '../components/OfflineBar';
import { COLORS } from '../styles/themes';

class ReceiveScreen extends React.Component {
  constructor(props) {
    super(props);
    /**
     * index {number} Selected index of the tab bar
     */
    this.state = {
      index: 0,
      // eslint thinks routes is not used, but TabView uses it
      // eslint-disable-next-line react/no-unused-state
      routes: [
        { key: 'address', title: t`My Address` },
        { key: 'paymentRequest', title: t`Payment Request` },
      ],
    };

    // Reference to payment request component
    this.paymentRequest = React.createRef();
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
          />
        );
      case 'paymentRequest':
        return (
          <NewPaymentRequest
            navigation={this.props.navigation}
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
    const renderTabBar = (props) => (
      <TabBar
        {...props}
        indicatorStyle={{ backgroundColor: COLORS.tabBarBackground }}
        style={{ backgroundColor: COLORS.backgroundColor }}
        labelStyle={{ color: COLORS.tabBarBackground }}
        getLabelText={this.getLabelText}
      />
    );

    return (
      <View style={{ flex: 1 }}>
        <Pressable style={{ flex: 1 }} onPress={() => Keyboard.dismiss()}>
          <HathorHeader
            title={t`RECEIVE`}
            withBorder
          />
          <TabView
            renderTabBar={(props) => renderTabBar(props)}
            navigationState={this.state}
            renderScene={this.renderScene}
            onIndexChange={this.handleIndexChange}
            initialLayout={{ width: Dimensions.get('window').width }}
          />
          <OfflineBar />
        </Pressable>
      </View>
    );
  }
}

export default ReceiveScreen;
