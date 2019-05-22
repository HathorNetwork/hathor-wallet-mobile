import React from 'react';
import { SafeAreaView } from 'react-native';
import HathorLogo from '../components/HathorLogo';

class SplashScreen extends React.Component {
  constructor(props) {
    super(props);
  }

  async componentDidMount() {
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
        <HathorLogo />
      </SafeAreaView>
    );
  }
}

export default SplashScreen;
