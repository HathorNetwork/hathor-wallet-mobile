/**
 * Copyright (c) Hathor Labs and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import React, { useEffect } from 'react';
import {
  StyleSheet, Text, View,
} from 'react-native';
import { useDispatch, useSelector } from 'react-redux';
import { t } from 'ttag';

import {
  onWalletReload,
  resetLoadedData,
} from '../actions';
import SimpleButton from '../components/SimpleButton';
import Spinner from '../components/Spinner';
import { COLORS } from '../styles/themes';

export default function TokenSwapLoadingScreen() {
  const dispatch = useDispatch();
  /**
   * @type {null|'loading'|'loaded'|'error'} progress on loading tx history
   */
  const loadTokenStatus = useSelector((state) => state.swapToken.loadTokenStatus);

  useEffect(() => {
    dispatch(resetLoadedData());
  }, []);

  const renderError = () => (
    <View style={{ alignItems: 'center' }}>
      <Text style={{
        fontSize: 18, lineHeight: 22, width: 200, textAlign: 'center'
      }}
      >
        There&apos;s been an error loading the token swap protocol.
      </Text>
      <SimpleButton
        containerStyle={{ marginTop: 12 }}
        textStyle={{ fontSize: 18 }}
        onPress={() => dispatch(onWalletReload())}
        title={t`Try again`}
      />
    </View>
  );

  const renderLoading = () => (
    <View style={{ alignItems: 'center' }}>
      <Spinner size={48} animating />
      <Text style={[styles.text, { marginTop: 32, color: COLORS.textColorShadow }]}>
        {t`Loading Token Swap`}
      </Text>
    </View>
  );

  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
      {loadTokenStatus === 'error' ? renderError() : renderLoading()}
    </View>
  );
}

const styles = StyleSheet.create({
  text: {
    fontSize: 16,
    lineHeight: 20,
    textAlign: 'center',
    marginTop: 16,
  },
});
