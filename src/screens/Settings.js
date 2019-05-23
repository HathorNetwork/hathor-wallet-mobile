import React from "react";
import { Alert, SafeAreaView, Text, View } from "react-native";
import HathorButton from "../components/HathorButton";
import HathorLogo from "../components/HathorLogo";

export class Settings extends React.Component {
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
    return (
      <SafeAreaView style={{ flex: 1, justifyContent: "space-between", alignItems: "center" }}>
        <HathorLogo style={{ marginTop: 24 }} resizeMode="center" />
        <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
          <Text style={{ lineHeight: 30, fontSize: 16, fontWeight: "bold" }}>Connected to</Text>
          <Text>{global.hathorLib.helpers.getServerURL()}</Text>
          <HathorButton
            onPress={this.buttonClick}
            title="Reset wallet"
            style={{ marginTop: 24 }}
          />
        </View>
        <View>
        </View>
      </SafeAreaView>
    );
  }
}
