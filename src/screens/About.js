import React from 'react';
import {
  Linking,
  ScrollView,
  StyleSheet,
  Image,
  SafeAreaView,
  Text,
  View,
} from 'react-native';
import HathorHeader from '../components/HathorHeader';
import baseStyle from '../styles/init';
import { Strong } from '../utils';

export class About extends React.Component {
  style = Object.assign({}, baseStyle, StyleSheet.create({
    view: {
      padding: 16,
      justifyContent: 'space-between',
    },
    logo: {
      height: 30,
      width: 170,
    },
    logoView: {
      marginTop: 16,
      marginBottom: 16,
    },
  }));

  render() {
    const Link = props => <Text style={this.style.link} onPress={() => Linking.openURL(props.href)}>{props.children}</Text>;
    return (
      <SafeAreaView>
        <HathorHeader
          title="ABOUT"
          onBackPress={() => this.props.navigation.goBack()}
          wrapperStyle={{ borderBottomWidth: 0 }}
        />
        <ScrollView pinchGestureEnabled={false} contentContainerStyle={this.style.view}>
          <View style={this.props.logoView}>
            <Image
              source={require('../assets/images/hathor-logo.png')}
              style={this.style.logo}
              resizeMode="contain"
            />
          </View>
          <Text style={this.style.title}>Hathor Labs</Text>
          <Text style={this.style.text}>This app is developed by Hathor Labs and is distributed for free.</Text>

          <Text style={this.style.text}>
This wallet is connected to a
            <Strong>testnet</Strong>
.
          </Text>
          <Text style={this.style.text}>
This means that
            <Strong>your Hathor token (HTR) and any other token may be reset at any time.</Strong>
          </Text>
          <Text style={this.style.text}>If someone offers to sell some tokens to you, that person is a scammer.</Text>
          <Text style={this.style.text}>
For further information, check our website
            <Link href="https://hathor.network">https://hathor.network/</Link>
.
          </Text>

          <Text style={this.style.title}>MIT License</Text>
          <Text style={this.style.text}>Copyright 2019 Hathor Labs</Text>
          <Text style={this.style.text}>Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:</Text>
          <Text style={this.style.text}>The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.</Text>
          <Text style={this.style.text}>THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.</Text>
        </ScrollView>
      </SafeAreaView>
    );
  }
}

export default About;
