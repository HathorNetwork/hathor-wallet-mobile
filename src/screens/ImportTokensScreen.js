/**
 * Copyright (c) Hathor Labs and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import React, { useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Linking,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSelector } from 'react-redux';
import { useNavigation } from '@react-navigation/native';
import { t } from 'ttag';
import { numberUtils, constants } from '@hathor/wallet-lib';
import HathorHeader from '../components/HathorHeader';
import NewHathorButton from '../components/NewHathorButton';
import { CircleInfoIcon } from '../components/Icons/CircleInfo.icon';
import { COLORS } from '../styles/themes';
import { getShortHash } from '../utils';
import { OpenInNewIcon } from '../components/Icons/OpenInNew.icon';

/**
 * ImportTokensScreen displays a list of unregistered tokens found in the wallet.
 * The user can select one or more tokens and proceed to the confirmation screen.
 */
const ImportTokensScreen = () => {
  const navigation = useNavigation();
  const unregisteredTokens = useSelector((state) => state.tokenImport.unregisteredTokens);
  const loading = useSelector((state) => state.tokenImport.loading);
  const explorerUrl = useSelector((state) => state.networkSettings.explorerUrl);

  const [tokenList, setTokenList] = useState(
    () => Object.values(unregisteredTokens).map(
      (token) => ({ ...token, selected: false })
    )
  );

  const hasTokens = tokenList.length > 0;
  const hasSelection = tokenList.some((tk) => tk.selected);

  const toggleToken = (uid) => {
    setTokenList((prev) => prev.map((token) => (
      token.uid === uid
        ? { ...token, selected: !token.selected }
        : token
    )));
  };

  const handleContinue = () => {
    const selectedTokens = tokenList.filter((tk) => tk.selected);
    navigation.navigate('ConfirmImportScreen', { tokens: selectedTokens });
  };

  const handleOpenExplorer = (uid) => {
    if (explorerUrl) {
      Linking.openURL(`${explorerUrl}/token_detail/${uid}`);
    }
  };

  const handleRegisterToken = () => {
    navigation.navigate('RegisterToken');
  };

  const formatBalance = (token) => {
    const available = token.balance?.available ?? 0;
    return `${numberUtils.prettyValue(available, constants.DECIMAL_PLACES)} ${token.symbol}`;
  };

  const renderTokenItem = ({ item, index }) => {
    const isSelected = item.selected;
    const isLast = index === tokenList.length - 1;

    return (
      <TouchableOpacity
        style={[styles.tokenItem, !isLast && styles.tokenItemBorder]}
        onPress={() => toggleToken(item.uid)}
        activeOpacity={0.7}
      >
        <View style={styles.tokenLeft}>
          <View style={[styles.checkbox, isSelected && styles.checkboxSelected]}>
            {isSelected && <Text style={styles.checkmark}>&#10003;</Text>}
          </View>
          <View style={styles.tokenInfo}>
            <Text style={styles.tokenName} numberOfLines={1}>{item.name}</Text>
            <Text style={styles.tokenBalance} numberOfLines={1}>{formatBalance(item)}</Text>
          </View>
        </View>
        <View style={styles.tokenRight}>
          <Text style={styles.tokenUid} numberOfLines={1}>{getShortHash(item.uid, 5)}</Text>
          <TouchableOpacity onPress={() => handleOpenExplorer(item.uid)} hitSlop={8}>
            <OpenInNewIcon size={20} color={COLORS.primary} />
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    );
  };

  const renderEmptyState = () => (
    <View style={styles.emptyContainer}>
      <Text style={styles.emptyTitle}>
        {t`No tokens available to import`}
      </Text>
      <Text style={styles.emptyDescription}>
        {t`We didn't find any unregistered tokens linked to your wallet.`}
      </Text>
      <Text style={styles.emptyDescription}>
        {t`You can register a new one manually.`}
      </Text>
      <TouchableOpacity onPress={handleRegisterToken}>
        <Text style={styles.registerLink}>
          {t`Register a token`}
        </Text>
      </TouchableOpacity>
    </View>
  );

  const renderContent = () => {
    if (loading) {
      return (
        <View style={styles.emptyContainer}>
          <ActivityIndicator size='large' color={COLORS.textColor} />
        </View>
      );
    }

    if (!hasTokens) {
      return renderEmptyState();
    }

    return (
      <View style={styles.content}>
        <Text style={styles.instructionText}>
          {t`Select the tokens you want to add to your wallet.`}
        </Text>

        <View style={styles.infoBanner}>
          <CircleInfoIcon size={20} color='#4a90d9' />
          <View style={styles.infoBannerTextContainer}>
            <Text style={styles.infoBannerTitle}>
              {t`Check before import tokens`}
            </Text>
            <Text style={styles.infoBannerDescription}>
              {t`Adding tokens is your responsibility. Make sure you recognize the source.`}
            </Text>
          </View>
        </View>

        <Text style={styles.sectionTitle}>
          {t`Tokens found`} ({tokenList.length})
        </Text>

        <FlatList
          data={tokenList}
          keyExtractor={(item) => item.uid}
          renderItem={renderTokenItem}
          style={styles.tokenListCard}
          contentContainerStyle={styles.tokenListContent}
        />
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <HathorHeader
        title={t`IMPORT TOKENS`}
        onBackPress={() => navigation.goBack()}
      />
      <View style={styles.body}>
        {renderContent()}
      </View>
      {hasTokens && !loading && (
        <View style={styles.footer}>
          <NewHathorButton
            title={t`Continue`}
            onPress={handleContinue}
            disabled={!hasSelection}
          />
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.backgroundColor,
  },
  body: {
    flex: 1,
  },
  content: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  instructionText: {
    fontSize: 14,
    color: COLORS.textColor,
    marginBottom: 24,
  },
  infoBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#daf1ff',
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 8,
    gap: 8,
    marginBottom: 32,
  },
  infoBannerTextContainer: {
    flex: 1,
  },
  infoBannerTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.textColor,
    lineHeight: 20,
  },
  infoBannerDescription: {
    fontSize: 12,
    color: COLORS.textColor,
    lineHeight: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: COLORS.textColor,
    marginBottom: 16,
  },
  tokenListCard: {
    flex: 1,
  },
  tokenListContent: {
    backgroundColor: COLORS.backgroundColor,
    borderRadius: 16,
    shadowColor: COLORS.textColor,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
    paddingVertical: 16,
  },
  tokenItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  tokenItemBorder: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: COLORS.borderColor,
  },
  tokenLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 12,
  },
  checkbox: {
    width: 18,
    height: 18,
    borderRadius: 2,
    borderWidth: 2,
    borderColor: '#49454f',
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxSelected: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  checkmark: {
    color: COLORS.white,
    fontSize: 12,
    fontWeight: '700',
    lineHeight: 14,
  },
  tokenInfo: {
    flexShrink: 1,
    gap: 2,
  },
  tokenName: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.textColor,
    lineHeight: 20,
  },
  tokenBalance: {
    fontSize: 14,
    color: COLORS.textColor,
    lineHeight: 20,
  },
  tokenRight: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
  },
  tokenUid: {
    fontSize: 12,
    color: '#616161',
    lineHeight: 20,
  },
  footer: {
    paddingHorizontal: 16,
    paddingBottom: 24,
    paddingTop: 8,
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 34,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.textColor,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 24,
  },
  emptyDescription: {
    fontSize: 14,
    color: COLORS.textColor,
    textAlign: 'center',
    lineHeight: 20,
  },
  registerLink: {
    fontSize: 14,
    color: COLORS.primary,
    textAlign: 'center',
    lineHeight: 20,
    marginTop: 24,
  },
});

export default ImportTokensScreen;
