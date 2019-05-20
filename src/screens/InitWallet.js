import React from 'react';
import { Button, Text, TextInput, View } from 'react-native';

//const hathorLib = require('@hathor/wallet-lib');

const InitialScreen = props => {
  return (
    <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
      <Text>Hello, world!</Text>
      <Button
        onPress={() => props.navigation.navigate('NewWordsScreen')}
        title="New Wallet"
      />
      <Button
        onPress={() => props.navigation.navigate('LoadWordsScreen')}
        title="Import Wallet"
      />
    </View>
  )
}

class NewWordsScreen extends React.Component {
  constructor(props) {
    super(props);
    this.state = { words: global.hathorLib.wallet.generateWalletWords(global.hathorLib.constants.HD_WALLET_ENTROPY) };
  }

  render() {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
        <Text selectable>{ this.state.words }</Text>
        <Button
          onPress={() => this.props.navigation.navigate('Home', {words: this.state.words})}
          title="Got it"
        />
      </View>
    );
  }
}

class LoadWordsScreen extends React.Component {
  constructor(props) {
    super(props);
    this.state = { words: "noble solve screen casino vacant number crazy blush embrace pen smart nominee funny zero mouse number sleep large world plate symbol panda zoo supply" };
  }

  render() {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
        <Text>Load wallet</Text>
        <TextInput
          style={{height: 40, borderColor: 'gray', borderWidth: 1}}
          onChangeText={(text) => this.setState({words: text})}
          placeholder='Enter words separated by a single space'
          multiline = {true}
          numberOfLines = {6}
        />
        <Button
          onPress={() => this.props.navigation.navigate('Home', {words: this.state.words})}
          disabled={!this.state.words}
          title="Go"
        />
      </View>
    );
  }
}

export { InitialScreen, LoadWordsScreen, NewWordsScreen };
