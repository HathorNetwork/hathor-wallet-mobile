import React from "react";
import {
  Linking,
  ScrollView,
  StyleSheet,
  Image,
  SafeAreaView,
  Text,
  View,
  Switch,
} from "react-native";
import HathorHeader from '../components/HathorHeader';
import baseStyle from '../styles/init';
import { Strong } from '../utils';
import { isBiometryEnabled, setBiometryEnabled, getSupportedBiometry, getTokenLabel } from '../utils';
import { HathorList, ListItem, ListMenu } from '../components/HathorList';

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


  constructor(props) {
    super(props);
    const biometryEnabled = isBiometryEnabled();

    /**
     * biometryEnabled {boolean} If user enabled biometry
     * supportedBiometry {str} Type of biometry supported
     */
    this.state = {
      biometryEnabled,
      supportedBiometry: getSupportedBiometry(),
    };
  }

  onBiometrySwitchChange = (value) => {
    this.setState({ biometryEnabled: value });
    setBiometryEnabled(value);
  }


  render() {
    const Link = (props) => <Text style={this.style.link} onPress={() => Linking.openURL(props.href)}>{props.children}</Text>;
    const switchDisabled = !this.supportedBiometry;
    const biometryText = (switchDisabled ? 'No biometry supported' : `Use ${this.supportedBiometry}`);
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: '#F7F7F7' }}>
        <HathorHeader
          title='SECURITY'
          onBackPress={() => this.props.navigation.goBack()}
          wrapperStyle={{ borderBottomWidth: 0 }}
        />
        <HathorList>
          <ListItem
            title={biometryText}
            text={
              <Switch
                onValueChange={this.onBiometrySwitchChange}
                value={this.state.biometryEnabled}
                disabled={switchDisabled}
              />
            }
            isFirst={true} />
          <ListMenu title='Change PIN' />
          <ListMenu title='Backup your seed words' isLast={true} />
        </HathorList>
      </SafeAreaView>
    );
  }
}

export default About;
