import React from 'react';
import {
  Keyboard,
  KeyboardAvoidingView,
  Linking,
  Platform,
  SafeAreaView,
  StatusBar,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableWithoutFeedback,
  View
} from 'react-native';
import HathorButton from '../components/HathorButton';

class WelcomeScreen extends React.Component {
  static navigationOptions = {
    headerTitleContainerStyle: {
      marginLeft: 0,
    },
  };

  state = { switchValue: false };

  toggleSwitch = (value) => {
    this.setState({ switchValue: value });
  }

  render() {
    return (
      <View style={initStyle.container}>
        <Text style={{ fontWeight: "bold", fontSize: 20 }}>Welcome to Hathor Testnet!</Text>
        <View style={[initStyle.textMarginBottom, initStyle.textMarginTop]}>
          <Text style={ initStyle.text }>This wallet is connected to a testnet.</Text>
          <Text style={ initStyle.text }>Your HTR and other tokens may be reset at any time.</Text>
          <Text style={ initStyle.text }>If someone offers to sell some tokens to you, that person is a scammer.</Text>
          <Text style={ initStyle.text }>For further information, check our website 
            <Text style={{ color: "#0273a0" }} onPress={() => Linking.openURL("https://hathor.network/")}> https://hathor.network/</Text>
          .</Text>
        </View>
        <View style={{flexDirection:"row", padding: 16}}>
          <Switch
            onValueChange={this.toggleSwitch}
            value={this.state.switchValue}
          />
          <Text style={{padding: 5}}>I agree to participate in the testnet of Hathor, and I acknowledge that the tokens are not for real.</Text>
        </View>
        <HathorButton
          disabled={!this.state.switchValue}
          onPress={() => this.props.navigation.navigate('InitialScreen')}
          title="Get started"
        />
      </View>
    )
  }
}

const InitialScreen = props => {
  return (
    <View style={initStyle.container}>
      <Text>First, you need to initialize your wallet.</Text>
      <Text>You can either start a new wallet or import data from a wallet that already exists.</Text>
      <View style={{ marginTop: 24}}>
        <HathorButton
          onPress={() => props.navigation.navigate('NewWordsScreen')}
          title="New Wallet"
          style={{ marginBottom: 16 }}
        />
        <HathorButton
          onPress={() => props.navigation.navigate('LoadWordsScreen')}
          title="Import Wallet"
        />
      </View>
    </View>
  )
}

class NewWordsScreen extends React.Component {
  state = {
    words: global.hathorLib.wallet.generateWalletWords(global.hathorLib.constants.HD_WALLET_ENTROPY)
  };

  render() {
    const wordsArr = this.state.words ? this.state.words.split(' ') : [];
    const wordsPerRow = 2;

    const renderWords = () => {
      const data = [];

      for (let i=0; i<wordsArr.length / wordsPerRow; i++) {
        data.push(renderWordsRow(i));
      }
      return data;
    }

    const renderWordsRow = (index) => {
      const startIndex = index*wordsPerRow;
      const wordsToRender = wordsArr.slice(startIndex, startIndex + wordsPerRow);

      const rows = wordsToRender.map((word, idx) => {
        const realIndex = startIndex + idx + 1;
        return (
          <View key={realIndex} style={{ flex: 1, alignItems: 'center' }}>
            <Text><Text style={{ fontWeight: "bold" }}>{realIndex}.</Text> {word} </Text>
          </View>
        )
      }); 

      return <View key={index} style={{ flex: 1, flexDirection: 'row', alignItems: 'center'}}>{ rows }</View>
    }

    return (
      <View style={initStyle.container}>
        <View style={initStyle.textMarginBottom}>
          <Text style={initStyle.text}>Your wallet has been created!</Text>
          <Text style={initStyle.text}>You must save the words below in the same order, so you can load this wallet again in the future.</Text>
        </View>
        {renderWords()}
        <HathorButton
          onPress={() => this.props.navigation.navigate('Home', {words: this.state.words})}
          title="Got it"
          style={{ marginTop: 24 }}
        />
      </View>
    );
  }
}

class LoadWordsScreen extends React.Component {
  state = {
    words: "",
    errorMessage: "",
  };

  loadClicked = () => {
    Keyboard.dismiss();
    const words = this.state.words.trim();
    this.setState({ errorMessage: "" })
    const result = global.hathorLib.wallet.wordsValid(words);
    if (result.valid) {
      this.props.navigation.navigate('Home', {words});
    } else {
      this.setState({ errorMessage: result.message });
    }
  }

  render() {
    return (
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : null} style={{ flex: 1 }}>
        <SafeAreaView style={{ flex: 1 }}>
          <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
            <View style={initStyle.container}>
              <Text>Write the 24 words of your wallet (separated by space).</Text>
              <TextInput
                style={{height: 100, borderColor: 'gray', borderWidth: 1, padding: 16, marginTop: 24, marginBottom: 16}}
                textAlignVertical="top"
                onChangeText={(text) => this.setState({words: text})}
                placeholder='Enter words separated by a single space'
                multiline = {true}
                keyboardAppearance='dark'
                returnKeyType='done'
                enablesReturnKeyAutomatically={true}
                autoFocus={true}
                onSubmitEditing={this.loadClicked}
                blurOnSubmit={true}
              />
              <Text style={{ color: 'red' }}>{this.state.errorMessage}</Text>
              <HathorButton
                onPress={this.loadClicked}
                disabled={!this.state.words}
                title="Go"
                style={{ marginTop: 8 }}
              />
            </View>
          </TouchableWithoutFeedback>
        </SafeAreaView>
      </KeyboardAvoidingView>
    );
  }
}

const initStyle = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 16,
  },
  textMarginTop: {
    marginTop: 24,
  },
  textMarginBottom: {
    marginBottom: 24,
  },
  text: {
    lineHeight: 24,
    fontSize: 14,
  },
});

export { WelcomeScreen, InitialScreen, LoadWordsScreen, NewWordsScreen };
