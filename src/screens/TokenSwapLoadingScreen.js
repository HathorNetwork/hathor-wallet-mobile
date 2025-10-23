/**
 * Copyright (c) Hathor Labs and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import React, { useEffect, useState } from 'react';
import {
  StyleSheet, Text, View,
} from 'react-native';
import { useDispatch, useSelector } from 'react-redux';
import { t } from 'ttag';

import {
  tokenSwapFetchAllowedTokens,
} from '../actions';
import SimpleButton from '../components/SimpleButton';
import Spinner from '../components/Spinner';
import { TOKEN_SWAP_ALLOWED_TOKEN_STATUS } from '../constants';
import { useNavigation } from '../hooks/navigation';
import { COLORS } from '../styles/themes';
import { selectTokenSwapAllowedTokens } from '../utils';

export default function TokenSwapLoadingScreen() {
  const dispatch = useDispatch();
  const loadTokenStatus = useSelector((state) => state.tokenSwapAllowedTokensRequestStatus);
  const allowedTokens = useSelector(selectTokenSwapAllowedTokens);
  const navigation = useNavigation();
  /** @type {'loading'|'loaded'|'success'|'error'} */
  const [loadingState, setLoadingState] = useState('loading');
  const [hasError, setError] = useState(false);

  useEffect(() => {
    // Only request to load if we are not already loading or loaded
    if (loadTokenStatus === TOKEN_SWAP_ALLOWED_TOKEN_STATUS.READY) {
      setError(false);
      setLoadingState('loading');
      dispatch(tokenSwapFetchAllowedTokens());
    }

    // If the request is finished we set the state to `loaded` to start validation.
    if (loadTokenStatus === TOKEN_SWAP_ALLOWED_TOKEN_STATUS.SUCCESSFUL) {
      setError(false);
      setLoadingState('loaded');
    }

    if (loadTokenStatus === TOKEN_SWAP_ALLOWED_TOKEN_STATUS.FAILED) {
      setError(true);
      setLoadingState('error');
    }
  }, [loadTokenStatus]);

  useEffect(() => {
    if (loadingState === 'loaded') {
      // Validate allowedTokens
      if (!allowedTokens) {
        setError(true);
      } else {
        setError(false);
        setLoadingState('ready');
      }
    }

    if (loadingState === 'ready') {
      navigation.replace('TokenSwap');
    }
  }, [loadingState, allowedTokens]);

  function requestReload() {
    setError(false);
    setLoadingState('loading');
    dispatch(tokenSwapFetchAllowedTokens());
  }

  const renderError = () => (
    <View style={{ alignItems: 'center' }}>
      <Text style={{
        fontSize: 18, lineHeight: 22, width: 200, textAlign: 'center'
      }}
      >
        {t`There's been an error loading the token swap protocol.`}
      </Text>
      <SimpleButton
        containerStyle={{ marginTop: 12 }}
        textStyle={{ fontSize: 18 }}
        onPress={requestReload}
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
      {hasError ? renderError() : renderLoading()}
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
