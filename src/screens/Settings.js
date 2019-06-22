import React from "react";
import { connect } from 'react-redux';
import * as Keychain from 'react-native-keychain';
import {
  Alert,
  ScrollView,
  StyleSheet,
  Image,
  SafeAreaView,
  Switch,
  Text,
  View,
} from "react-native";
import HathorButton from "../components/HathorButton";
import OfflineBar from '../components/OfflineBar';
import { isBiometryEnabled, setBiometryEnabled, getSupportedBiometry, getTokenLabel } from '../utils';

import hathorLib from '@hathor/wallet-lib';

import { HathorList, ListItem, ListMenu } from '../components/HathorList';


/**
 * selectedToken {Object} Select token config {name, symbol, uid}
 * server {str} URL of the full node this wallet is connected to
 */
const mapStateToProps = (state) => {
  const server = hathorLib.storage.getItem("wallet:server");
  return {
    selectedToken: state.selectedToken,
    isOnline: state.isOnline,
    network: state.serverInfo.network,
    server: server,
  };
}

export class Settings extends React.Component {
  style = StyleSheet.create({
    scrollView: {
      flexGrow: 1,
      alignItems: 'center',
    },
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
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: '#F7F7F7' }}>
        <ScrollView contentContainerStyle={this.style.scrollView}>
          <View style={this.style.logoView}>
            <Image
              source={require('../assets/images/hathor-logo.png')}
              style={this.style.logo}
              resizeMode={"contain"}
            /> 
          </View>
          {(this.props.isOnline &&
            <View style={this.style.networkContainerView}>
              <Text>You are connected to</Text>
              <View style={this.style.networkView}>
                <Text style={this.style.networkText}>{this.props.network}</Text>
              </View>
            </View>
          )}

          <HathorList infinity={true}>
            <ListItem
              text={
                <View style={{ flex: 1 }}>
                  <Text style={{ marginBottom: 8, color: 'rgba(0, 0, 0, 0.5)', fontSize: 12 }}>Connected to</Text>
                  <Text
                    style={{ fontSize: 12 }}
                    adjustsFontSizeToFit={true}
                    minimumFontScale={0.5}
                  >{this.props.server}</Text>
                </View>
              }
              isFirst={true}
            />
            <ListMenu
              title='Security'
              onPress={() => this.props.navigation.navigate('Security')}
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
        </ScrollView>
        <OfflineBar />
      </SafeAreaView>
    );
  }
}

export default connect(mapStateToProps)(Settings);
