import React from 'react';
import { connect } from 'react-redux';

import { resetData } from '../hathorRedux';
import { SafeAreaView } from 'react-native';
import HathorLogo from '../components/HathorLogo';

/**
 * Only used for deciding which stack (App or Init) to display, so nothing is rendered.
 */
class DecideStackScreen extends React.Component {
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
    return null;
  }
}

export default connect(null)(DecideStackScreen);
