import React from "react";
import { Alert, Image, SafeAreaView, Text, View } from "react-native";
import HathorButton from "../components/HathorButton";
import { connect } from 'react-redux';
import { getTokenLabel } from '../utils';


/**
 * selectedToken {Object} Select token config {name, symbol, uid}
 */
const mapStateToProps = (state) => {
  return {
    selectedToken: state.selectedToken,
  };
}


class Settings extends React.Component {
  state = { isLoading: true };

  resetWallet = () => {
    //TODO we don't need to save server data
    const server = global.localStorage.getItem("wallet:server");

    global.hathorLib.wallet.unsubscribeAllAddresses();
    global.hathorLib.WebSocketHandler.endConnection();
    global.localStorage.clear();

    //TODO make sure asyncStorage is clear when doing this. Maybe temporarily use setTimeout?
    global.localStorage.setItem("wallet:server", server);
    this.props.navigation.navigate("Init");
  }

  buttonClick = () => {
    Alert.alert(
      "Reset wallet",
      "All your wallet information will be deleted. Make sure you have your words backed up.",
      [
        {text: "Cancel", style: "cancel"},
        {text: "OK", onPress: this.resetWallet},
      ],
      {cancelable: false},
    );
  }

  render() {
    const renderExploreButton = () => {
      if (this.props.selectedToken.uid === global.hathorLib.constants.HATHOR_TOKEN_CONFIG.uid) {
        return null;
      }

      return (
        <HathorButton
          onPress={() => this.props.navigation.navigate('TokenDetail')}
          title="Token detail"
          style={{ marginTop: 16 }}
        />
      );
    }

    return (
      <SafeAreaView style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
        <View style={{ height: 30, width: 170, marginTop: 16 }}>
          <Image
            source={require('../assets/images/hathor-logo.png')}
            style={{height: 30, width: 170 }}
            resizeMode={"contain"}
          /> 
        </View>
        <View style={{ flex: 1, justifyContent: "flex-start", alignItems: "center", marginTop: 32 }}>
          <View style={{ justifyContent: "center", alignItems: "center" }}>
            <Text style={{ lineHeight: 30, fontSize: 16, fontWeight: "bold" }}>Connected to</Text>
            <Text>{global.hathorLib.helpers.getServerURL()}</Text>
            <HathorButton
              onPress={this.buttonClick}
              title="Reset wallet"
              style={{ marginTop: 24 }}
            />
          </View>
          <View style={{ justifyContent: "center", alignItems: "center", marginTop: 24 }}>
            <Text style={{ lineHeight: 30, fontSize: 16, fontWeight: "bold" }}>Selected token</Text>
            <Text>{getTokenLabel(this.props.selectedToken)}</Text>
            <View style={{ flex: 1, justifyContent: "flex-start", alignItems: "center", marginTop: 24 }}>
              {renderExploreButton()}
              <HathorButton
                onPress={() => this.props.navigation.navigate('RegisterToken')}
                title="Register a token"
                style={{ marginTop: 16 }}
              />
              <HathorButton
                onPress={() => this.props.navigation.navigate('CreateToken')}
                title="Create a token"
                style={{ marginTop: 16 }}
              />
            </View>
          </View>
        </View>
      </SafeAreaView>
    );
  }
}

export default connect(mapStateToProps)(Settings);
