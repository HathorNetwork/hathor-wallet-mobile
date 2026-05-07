/**
 * Copyright (c) Hathor Labs and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import React, { useState, useCallback } from 'react';
import {
  FlatList, StyleSheet, Text, TouchableOpacity, View,
} from 'react-native';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigation } from '@react-navigation/native';
import { t } from 'ttag';
import { numberUtils, constants } from '@hathor/wallet-lib';
import HathorHeader from '../components/HathorHeader';
import NewHathorButton from '../components/NewHathorButton';
import ImportTokensModal from '../components/ImportTokensModal';
import { tokenImportRequested, tokenImportResetStatus } from '../actions';
import { COLORS } from '../styles/themes';
import { useParams } from '../hooks/navigation';
import { TOKEN_DOWNLOAD_STATUS } from '../sagas/tokens';

/**
 * Screen that displays the list of tokens the user is about to import,
 * and allows them to confirm or go back.
 *
 * Route params:
 * @param {Array} tokens - Array of token objects to import
 *   Each token: { uid, name, symbol }
 */
const ConfirmImportScreen = () => {
  const dispatch = useDispatch();
  const navigation = useNavigation();
  const { tokens } = useParams();
  const importStatus = useSelector((state) => state.tokenImport.importStatus);
  const tokensBalance = useSelector((state) => state.tokensBalance);

  const [showModal, setShowModal] = useState(false);

  const handleImportPress = useCallback(() => {
    // Reset any stale terminal status (SUCCESS/ERROR) from a prior session
    // before opening the modal, so the user never sees a one-frame flash of
    // the previous result before the IMPORTING state takes over.
    dispatch(tokenImportResetStatus());
    setShowModal(true);
    dispatch(tokenImportRequested(tokens));
  }, [dispatch, tokens]);

  const handleDismiss = useCallback(() => {
    setShowModal(false);
    dispatch(tokenImportResetStatus());
    // Navigate back to the main dashboard
    navigation.popToTop();
  }, [dispatch, navigation]);

  const handleRetry = useCallback(() => {
    dispatch(tokenImportResetStatus());
    dispatch(tokenImportRequested(tokens));
  }, [dispatch, tokens]);

  const handleBackPress = useCallback(() => {
    navigation.goBack();
  }, [navigation]);

  const formatBalance = (token) => {
    const entry = tokensBalance[token.uid];
    if (!entry || entry.status !== TOKEN_DOWNLOAD_STATUS.READY) {
      return `— ${token.symbol}`;
    }
    const available = entry.data?.available ?? 0n;
    return `${numberUtils.prettyValue(available, constants.DECIMAL_PLACES)} ${token.symbol}`;
  };

  const renderTokenItem = ({ item, index }) => {
    const isLast = index === tokens.length - 1;
    return (
      <View style={[styles.tokenRow, !isLast && styles.tokenRowBorder]}>
        <View style={styles.tokenInfo}>
          <View style={styles.symbolTag}>
            <Text style={styles.symbolText} numberOfLines={1}>{item.symbol}</Text>
          </View>
          <Text style={styles.tokenName} numberOfLines={1}>{item.name}</Text>
        </View>
        <Text style={styles.tokenBalance} numberOfLines={1}>
          {formatBalance(item)}
        </Text>
      </View>
    );
  };

  const keyExtractor = (item) => item.uid;

  return (
    <View style={styles.container}>
      <HathorHeader
        title={t`IMPORT TOKENS`}
        onBackPress={handleBackPress}
      />

      {showModal && (
        <ImportTokensModal
          status={importStatus}
          onDismiss={handleDismiss}
          onRetry={handleRetry}
        />
      )}

      <View style={styles.content}>
        <View style={styles.topSection}>
          <Text style={styles.title}>{t`Confirm Import`}</Text>
          <Text style={styles.description}>
            {t`You are about to add these tokens to your wallet:`}
          </Text>
          <View style={styles.tokenListCard}>
            <FlatList
              data={tokens}
              renderItem={renderTokenItem}
              keyExtractor={keyExtractor}
            />
          </View>
        </View>

        <View style={styles.bottomSection}>
          <NewHathorButton
            title={t`Import tokens`}
            onPress={handleImportPress}
            disabled={showModal}
          />
          <TouchableOpacity
            style={styles.backButton}
            onPress={handleBackPress}
            disabled={showModal}
          >
            <Text style={styles.backButtonText}>{t`Back`}</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.backgroundColor,
  },
  content: {
    flex: 1,
    paddingHorizontal: 16,
  },
  topSection: {
    flex: 1,
    paddingTop: 32,
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    color: COLORS.textColor,
    marginBottom: 32,
  },
  description: {
    fontSize: 14,
    color: COLORS.textColor,
    marginBottom: 16,
  },
  tokenListCard: {
    flexShrink: 1,
    backgroundColor: COLORS.backgroundColor,
    borderRadius: 16,
    shadowColor: COLORS.black,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
    paddingVertical: 16,
  },
  tokenRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  tokenRowBorder: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: COLORS.borderColor,
  },
  tokenInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 8,
  },
  symbolTag: {
    backgroundColor: COLORS.tagSurface,
    borderRadius: 4,
    minWidth: 40,
    height: 23,
    paddingHorizontal: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  symbolText: {
    fontSize: 14,
    fontWeight: 'bold',
    color: COLORS.textColor,
    textAlign: 'center',
  },
  tokenName: {
    fontSize: 14,
    fontWeight: 'bold',
    color: COLORS.textColor,
    marginLeft: 8,
    flexShrink: 1,
  },
  tokenBalance: {
    fontSize: 14,
    color: COLORS.textColor,
    textAlign: 'right',
  },
  bottomSection: {
    paddingBottom: 21,
    alignItems: 'center',
  },
  backButton: {
    paddingVertical: 16,
    alignItems: 'center',
  },
  backButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.freeze300,
    textTransform: 'uppercase',
  },
});

export default ConfirmImportScreen;
