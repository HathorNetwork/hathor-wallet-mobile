import React from "react";
import { connect } from 'react-redux';
import * as Keychain from 'react-native-keychain';

import { Alert, StyleSheet, Image, SafeAreaView, Switch, Text, View } from "react-native";
import HathorButton from "../components/HathorButton";
import { isBiometryEnabled, setBiometryEnabled, getSupportedBiometry, getTokenLabel } from '../utils';

import hathorLib from '@hathor/wallet-lib';

import { HathorList, ListItem, ListMenu } from '../components/HathorList';


/**
 * selectedToken {Object} Select token config {name, symbol, uid}
 */
const mapStateToProps = (state) => {
  return {
    selectedToken: state.selectedToken,
  };
}

export class Settings extends React.Component {
  style = StyleSheet.create({
    networkContainerView: {
      marginTop: 24,
      marginBottom: 24,
    },
    networkView: {
      backgroundColor: 'rgba(227, 0, 82, 0.1)',
      margin: 8,
      padding: 8,
      borderRadius: 8,
      alignItems: 'center',
    },
    networkText: {
      color: '#E30052',
      fontSize: 16,
      fontWeight: 'bold',
    },
    logoView: {
      height: 30,
      width: 170,
      marginTop: 16,
      marginBottom: 16,
    },
    logo: {
      height: 30,
      width: 170,
    },
  });

  render() {
    const renderExploreButton = () => {
      if (this.props.selectedToken.uid === hathorLib.constants.HATHOR_TOKEN_CONFIG.uid) {
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
      <SafeAreaView style={{ flex: 1, alignItems: "center", backgroundColor: '#F7F7F7' }}>
        <View style={this.style.logoView}>
          <Image
            source={require('../assets/images/hathor-logo.png')}
            style={this.style.logo}
            resizeMode={"contain"}
          /> 
        </View>
        <View style={this.style.networkContainerView}>
          <Text>You are connected to</Text>
          <View style={this.style.networkView}>
            <Text style={this.style.networkText}>testnet: alpha</Text>
          </View>
        </View>

        <HathorList infinity={true}>
          <ListMenu
            title='Security'
            onPress={() => this.props.navigation.navigate('Security')}
            isFirst={true}
          />
          <ListMenu
            title='Create a new token'
            onPress={() => this.props.navigation.navigate('CreateToken')}
          />
          <ListMenu
            title='Register a token'
            onPress={() => this.props.navigation.navigate('RegisterToken')}
          />
          <ListMenu
            title='Reset wallet'
            onPress={() => this.props.navigation.navigate('ResetWallet')}
          />
          <ListMenu
            title='About'
            onPress={() => this.props.navigation.navigate('About')}
          />
        </HathorList>

        {renderExploreButton()}
      </SafeAreaView>
    );
  }
}

export default connect(mapStateToProps)(Settings);
