import React from "react";
import { Alert, Button, SafeAreaView, Text, View } from "react-native";
//import { connect } from "react-redux";

//import { clearNetworkError, historyUpdate, networkError, newTx } from "../hathorRedux";

/*
const mapStateToProps = (state) => ({
  txList: state.txList,
  balance: state.balance,
  networkError: state.networkError,
})
*/

export class Settings extends React.Component {
  state = { isLoading: true };

  componentDidMount() {
    //global.hathorLib.WebSocketHandler.on("wallet", this.handleWebsocketMsg);
    //global.hathorLib.WebSocketHandler.on("reload_data", this.fetchDataFromServer);
    //global.hathorLib.WebSocketHandler.on("is_online", this.handleWebsocketStateChange);
  }

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
      <SafeAreaView style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
        <Text>Settings</Text>
        <Button
          onPress={this.buttonClick}
          title="Reset wallet"
        />
        <Text>Conected to {global.hathorLib.helpers.getServerURL()}</Text>
      </SafeAreaView>
    );
  }
}

//export default connect(mapStateToProps)(MainScreen)
