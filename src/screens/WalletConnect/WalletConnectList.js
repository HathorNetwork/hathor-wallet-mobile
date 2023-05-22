/**
 * Copyright (c) Hathor Labs and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import React from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { t } from 'ttag';
import { get } from 'lodash';
import {
  StyleSheet,
  SafeAreaView,
  Text,
  View,
  Image,
  TouchableOpacity,
  Alert,
} from 'react-native';

import HathorHeader from '../../components/HathorHeader';
import SimpleButton from '../../components/SimpleButton';
import { HathorList } from '../../components/HathorList';
import { walletConnectCancelSession } from '../../actions';


const style = StyleSheet.create({
  componentWrapper: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f7f7f7',
    alignSelf: 'stretch',
  },
  safeAreaView: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    alignSelf: 'stretch',
  },
  buttonWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#cecece',
    paddingBottom: 16,
  },
  image: {
    width: 50,
    height: 50,
    borderRadius: 25,
    marginTop: 16,
    marginLeft: 16,
  },
  dataWrapper: {
    flexDirection: 'column',
    marginLeft: 16,
    marginRight: 16,
    marginTop: 16,
  },
  sessionName: {
    marginBottom: 8,
    color: 'rgba(0, 0, 0, 0.87)',
    fontSize: 12,
    fontWeight: 'bold',
  },
  sessionData: {
    marginBottom: 8,
    color: 'rgba(0, 0, 0, 0.57)',
    fontSize: 12,
  },
  sessionListWrapper: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    margin: 8,
    alignSelf: 'stretch',
    borderRadius: 30,
  }
});

export default function WalletConnectList({ navigation }) {
  const dispatch = useDispatch();
  const connectedSessions = useSelector((state) => state.walletConnectSessions);

  const mappedSessions = Object.keys(connectedSessions).reduce((acc, sessionKey) => {
    const session = connectedSessions[sessionKey];

    return [...acc, {
      sessionKey,
      description: get(session, 'peer.metadata.description'),
      icon: get(session, 'peer.metadata.icons[0]'),
      url: get(session, 'peer.metadata.url'),
      name: get(session, 'peer.metadata.name'),
    }];
  }, []);

  const renderHeaderRightElement = () => (
    <SimpleButton
      // translator: Used when the QR Code Scanner is opened, and user will manually
      // enter the information.
      title={t`Add`}
      onPress={() => navigation.navigate('WalletConnectScan')}
    />
  );

  const onLongPress = (sessionKey) => {
    Alert.alert(t`End session`, t`This will disconnect the session.`, [
      {
        text: t`End`,
        onPress: () => {
          dispatch(walletConnectCancelSession(sessionKey));
        },
      },
      {
        text: t`Cancel`,
        onPress: () => {
        },
        style: 'cancel',
      }
    ]);
  };

  return (
    <View style={style.componentWrapper}>
      <SafeAreaView style={style.safeAreaView}>
        <HathorHeader
          title={t`Wallet Connect Sessions`}
          onBackPress={() => navigation.pop()}
          rightElement={renderHeaderRightElement()}
        />
        <View style={style.sessionListWrapper}>
          <HathorList infinity>
            {mappedSessions.map(({
              sessionKey,
              icon,
              name,
              description,
              url,
            }) => (
              <TouchableOpacity onLongPress={() => onLongPress(sessionKey)}>
                <View style={style.buttonWrapper}>
                  <Image style={style.image} source={{ uri: icon }} />
                  <View style={style.dataWrapper}>
                    <Text style={style.sessionName}>
                      {name}
                    </Text>
                    <Text style={style.sessionData}>
                      {url}
                    </Text>
                    <Text style={style.sessionData}>
                      {description}
                    </Text>
                  </View>
                </View>
              </TouchableOpacity>
            ))}
          </HathorList>
        </View>
      </SafeAreaView>
    </View>
  );
}
