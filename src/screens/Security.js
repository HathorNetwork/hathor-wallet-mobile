import React from 'react';
import {
  Linking,
  StyleSheet,
  SafeAreaView,
  Text,
  Switch,
} from 'react-native';
import HathorHeader from '../components/HathorHeader';
import baseStyle from '../styles/init';
import {
  Strong, isBiometryEnabled, setBiometryEnabled, getSupportedBiometry,
} from '../utils';

import { HathorList, ListItem, ListMenu } from '../components/HathorList';

export class Security extends React.Component {
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
    /**
     * supportedBiometry {str} Type of biometry supported
     */
    this.supportedBiometry = getSupportedBiometry();

    /**
     * biometryEnabled {boolean} If user enabled biometry. If no biometry support, always false
     */
    this.state = {
      biometryEnabled: this.supportedBiometry && isBiometryEnabled(),
    };
  }

  onBiometrySwitchChange = (value) => {
    this.setState({ biometryEnabled: value });
    setBiometryEnabled(value);
  }


  render() {
    const Link = props => <Text style={this.style.link} onPress={() => Linking.openURL(props.href)}>{props.children}</Text>;
    const switchDisabled = !this.supportedBiometry;
    const biometryText = (switchDisabled ? 'No biometry supported' : `Use ${this.supportedBiometry}`);
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: '#F7F7F7' }}>
        <HathorHeader
          title="SECURITY"
          onBackPress={() => this.props.navigation.goBack()}
          wrapperStyle={{ borderBottomWidth: 0 }}
        />
        <HathorList>
          <ListItem
            title={biometryText}
            // if no biometry is supported, use default ListItem color (grey),
            // so it looks disabled. Else, color is black, as other items
            titleStyle={!switchDisabled ? { color: 'black' } : null}
            text={(
              <Switch
                onValueChange={this.onBiometrySwitchChange}
                value={this.state.biometryEnabled}
                disabled={switchDisabled}
              />
)}
            isFirst
          />
          <ListMenu
            title="Lock wallet"
            onPress={() => this.props.navigation.navigate('PinScreen')}
            isLast
          />
        </HathorList>
      </SafeAreaView>
    );
  }
}

export default Security;
