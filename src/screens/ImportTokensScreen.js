/**
 * Copyright (c) Hathor Labs and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import React, { useEffect, useState } from 'react';
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
import TokenListCard from '../components/TokenListCard';
import TokenItem from '../components/TokenItem';
import { CircleInfoIcon } from '../components/Icons/CircleInfo.icon';
import { COLORS } from '../styles/themes';
import { TOKEN_DOWNLOAD_STATUS } from '../sagas/tokens';
import { logger } from '../logger';

const log = logger('ImportTokensScreen');

/**
 * ImportTokensScreen displays a list of unregistered tokens found in the wallet.
 * The user can select one or more tokens and proceed to the confirmation screen.
 */
const ImportTokensScreen = () => {
  const navigation = useNavigation();
  const unregisteredTokens = useSelector((state) => state.tokenImport.unregisteredTokens);
  const loading = useSelector((state) => state.tokenImport.loading);
  const tokensBalance = useSelector((state) => state.tokensBalance);
  const explorerUrl = useSelector((state) => state.networkSettings.explorerUrl);

  // Selection lives locally; the visible list is derived from the store so any
  // newly detected unregistered tokens appear without needing to re-enter the screen.
  const [selectedUids, setSelectedUids] = useState(() => new Set());

  const tokenList = Object.values(unregisteredTokens).map((token) => ({
    ...token,
    selected: selectedUids.has(token.uid),
  }));

  // Drop selections for uids that are no longer in the unregistered list
  // (e.g. registered through another flow while the screen was open).
  useEffect(() => {
    setSelectedUids((prev) => {
      let changed = false;
      const next = new Set();
      prev.forEach((uid) => {
        if (unregisteredTokens[uid]) {
          next.add(uid);
        } else {
          changed = true;
        }
      });
      return changed ? next : prev;
    });
  }, [unregisteredTokens]);

  const hasTokens = tokenList.length > 0;
  const hasSelection = selectedUids.size > 0;

  const toggleToken = (uid) => {
    setSelectedUids((prev) => {
      const next = new Set(prev);
      if (next.has(uid)) {
        next.delete(uid);
      } else {
        next.add(uid);
      }
      return next;
    });
  };

  const handleContinue = () => {
    const selectedTokens = tokenList.filter((tk) => tk.selected);
    navigation.navigate('ConfirmImportScreen', { tokens: selectedTokens });
  };

  const handleOpenExplorer = async (uid) => {
    if (!explorerUrl) {
      return;
    }
    const url = `${explorerUrl}token_detail/${uid}`;
    try {
      const supported = await Linking.canOpenURL(url);
      if (!supported) {
        log.error(`Cannot open URL: ${url}`);
        return;
      }
      await Linking.openURL(url);
    } catch (e) {
      log.error(`Failed to open explorer URL ${url}:`, e);
    }
  };

  const handleRegisterToken = () => {
    navigation.navigate('RegisterToken');
  };

  const formatBalance = (token) => {
    const entry = tokensBalance[token.uid];
    if (!entry || entry.status !== TOKEN_DOWNLOAD_STATUS.READY) {
      return `— ${token.symbol}`;
    }
    const available = entry.data?.available ?? 0n;
    return `${numberUtils.prettyValue(available, constants.DECIMAL_PLACES)} ${token.symbol}`;
  };

  const renderTokenItem = ({ item, index }) => (
    <TokenItem
      token={item}
      balance={formatBalance(item)}
      isLast={index === tokenList.length - 1}
      isSelected={item.selected}
      onToggle={() => toggleToken(item.uid)}
      onOpenExplorer={() => handleOpenExplorer(item.uid)}
    />
  );

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
          <CircleInfoIcon size={20} color={COLORS.infoBannerAccent} />
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

        <TokenListCard style={styles.tokenListCard}>
          <FlatList
            data={tokenList}
            keyExtractor={(item) => item.uid}
            renderItem={renderTokenItem}
          />
        </TokenListCard>
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
    backgroundColor: COLORS.infoBannerBg,
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
