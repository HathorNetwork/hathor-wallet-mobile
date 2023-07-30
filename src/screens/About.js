import React from 'react';
import {
  Linking,
  ScrollView,
  StyleSheet,
  Text,
  TouchableWithoutFeedback,
  View,
  Platform,
} from 'react-native';
import { t } from 'ttag';
import VersionNumber from 'react-native-version-number';
import HathorHeader from '../components/HathorHeader';
import Logo from '../components/Logo';
import TextFmt from '../components/TextFmt';
import baseStyle from '../styles/init';
import { str2jsx } from '../utils';
import { TERMS_OF_SERVICE_URL, PRIVACY_POLICY_URL } from '../constants';

export class About extends React.Component {
  style = ({ ...baseStyle,
    ...StyleSheet.create({
      view: {
        padding: 16,
        justifyContent: 'space-between',
        flexGrow: 1,
      },
      logoView: {
        marginTop: 16,
        marginBottom: 16,
      },
    }) });

  touchCount = 0;

  onPressLogo = () => {
    // Method created to test error handling
    this.touchCount += 1;
    if (this.touchCount === 10) {
      throw new Error('Hathor test error.');
    }
  }

  renderVersionText(versionName, buildNumber) {
    return (<Text style={this.style.text}>{`v${versionName} (build ${buildNumber})`}</Text>);
  }

  renderBuildVersion() {
    if (Platform.OS === 'android') {
      // Android
      return this.renderVersionText(VersionNumber.appVersion, VersionNumber.buildVersion);
    }
    if (Platform.OS === 'ios') {
      // iOS
      const build = VersionNumber.buildVersion.split('.');
      if (build.length !== 3) {
        throw new Error('IOS build version is not in the correct format.');
      }
      if (build[0] === '0') {
        // This is a release candidate build
        return this.renderVersionText(`${VersionNumber.appVersion}-rc${build[1]}`, build[2]);
      }
      // This is an official release build
      return this.renderVersionText(VersionNumber.appVersion, build[2]);
    }
    throw new Error('Unsupported platform.');
  }

  render() {
    const Link = (props) => (
      <Text
        style={this.style.link}
        onPress={() => Linking.openURL(props.href)}
      >
        {props.children}
      </Text>
    );

    return (
      <View style={{ flex: 1, backgroundColor: baseStyle.container.backgroundColor }}>
        <HathorHeader
          title={t`ABOUT`}
          onBackPress={() => this.props.navigation.goBack()}
        />
        <ScrollView pinchGestureEnabled={false} contentContainerStyle={this.style.view}>
          <TouchableWithoutFeedback onPress={this.onPressLogo}>
            <View style={this.props.logoView}>
              <Logo />
            </View>
          </TouchableWithoutFeedback>
          { this.renderBuildVersion() }
          <Text style={this.style.title}>Hathor Labs</Text>
          <Text style={this.style.text}>
            {t`This app is developed by Hathor Labs and is distributed for free.`}
          </Text>

          <TextFmt style={this.style.text}>
            {t`This wallet is connected to the **mainnet**.`}
          </TextFmt>
          <Text style={this.style.text}>
            {t`A mobile wallet is not the safest place to store your tokens.
            So, we advise you to keep only a small amount of tokens here, such as pocket money.`}
          </Text>
          <Text style={this.style.text}>
            {str2jsx(
              t`For further information, check out the |link1:Terms of Service| and |link2:Privacy Policy|, or our website |link3:https://hathor.network/|.`,
              {
                link1: (x, i) => <Link key={i} href={TERMS_OF_SERVICE_URL}>{x}</Link>,
                link2: (x, i) => <Link key={i} href={PRIVACY_POLICY_URL}>{x}</Link>,
                link3: (x, i) => <Link key={i} href='https://hathor.network/'>{x}</Link>,
              }
            )}
          </Text>

          <Text style={this.style.title}>MIT License</Text>
          <Text style={this.style.text}>Copyright 2019 Hathor Labs</Text>
          <Text style={this.style.text}>
            Permission is hereby granted, free of charge, to any person obtaining a copy of this
            {' '}software and associated documentation files (the &quot;Software&quot;), to deal in
            {' '}the Software without restriction, including without limitation the rights to use,
            {' '}copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the
            {' '}Software, and to permit persons to whom the Software is furnished to do so,
            {' '}subject to the following conditions:
          </Text>
          <Text style={this.style.text}>
            The above copyright notice and this permission notice shall be included in all
            {' '}copies or substantial portions of the Software.
          </Text>
          <Text style={this.style.text}>
            THE SOFTWARE IS PROVIDED &quot;AS IS&quot;, WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
            {' '}IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS
            {' '}FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR
            {' '}COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN
            {' '}AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION
            {' '}WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
          </Text>
        </ScrollView>
      </View>
    );
  }
}

export default About;
