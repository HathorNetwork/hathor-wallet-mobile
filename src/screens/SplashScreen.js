import React from 'react';
import { SafeAreaView, Text } from 'react-native';
import { connect } from 'react-redux';

import { resetData } from '../hathorRedux';

class SplashScreen extends React.Component {
  constructor(props) {
    super(props);
  }

  async componentDidMount() {
    this.props.dispatch(resetData());
    await global.localStorage.rebuild();
    if (global.hathorLib.wallet.loaded()) {
      this.props.navigation.navigate("App");
    } else {
      this.props.navigation.navigate("Init");
    }
  }

  render() {
    return (
      <SafeAreaView style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
        <Text>Splash Screen</Text>
      </SafeAreaView>
    );
  }
}

export default connect(null)(SplashScreen);
