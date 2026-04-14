/**
 * Copyright (c) Hathor Labs and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import React, { useEffect, useCallback, useRef } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { t } from 'ttag';
import {
  StyleSheet,
  View,
  Text,
  Image,
  FlatList,
  Animated,
  TouchableOpacity,
} from 'react-native';
import HathorHeader from '../../components/HathorHeader';
import NewHathorButton from '../../components/NewHathorButton';
import {
  reownFetchPendingRequests,
  reownRejectAllPendingRequests,
  reownRejectPendingRequest,
} from '../../actions';
import { COLORS } from '../../styles/themes';

const METHOD_LABELS = {
  htr_signWithAddress: 'Sign Message',
  htr_sendNanoContractTx: 'Nano Contract Tx',
  htr_signOracleData: 'Sign Oracle Data',
  htr_createToken: 'Create Token',
  htr_sendTransaction: 'Send Transaction',
  htr_createNanoContractCreateTokenTx: 'Create NC Token Tx',
  htr_getBalance: 'Get Balance',
  htr_getAddress: 'Get Address',
  htr_getUtxos: 'Get UTXOs',
  htr_getConnectedNetwork: 'Get Network',
  htr_getWalletInformation: 'Get Wallet Info',
};

const getMethodCategory = (method) => {
  if (method.includes('send') || method.includes('create')) return 'write';
  if (method.includes('sign')) return 'sign';
  return 'read';
};

const getCategoryColor = (category) => {
  switch (category) {
    case 'write': return COLORS.feedbackWarning300;
    case 'sign': return COLORS.primary;
    case 'read': return COLORS.positiveBalanceColor;
    default: return COLORS.midContrastDetail;
  }
};

const getCategoryBgColor = (category) => {
  switch (category) {
    case 'write': return COLORS.feedbackWarning100;
    case 'sign': return COLORS.primaryOpacity10;
    case 'read': return COLORS.positiveBalanceBgColor;
    default: return COLORS.freeze100;
  }
};

const RequestCard = ({ item, onReject }) => {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const category = getMethodCategory(item.method);
  const categoryColor = getCategoryColor(category);
  const categoryBgColor = getCategoryBgColor(category);

  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 300,
      useNativeDriver: true,
    }).start();
  }, [fadeAnim]);

  return (
    <Animated.View style={[styles.requestCard, { opacity: fadeAnim }]}>
      <View style={styles.cardHeader}>
        <View style={styles.dappInfo}>
          {item.dapp.icon ? (
            <Image style={styles.dappIcon} source={{ uri: item.dapp.icon }} />
          ) : (
            <View style={[styles.dappIconPlaceholder, { backgroundColor: categoryBgColor }]}>
              <Text style={[styles.dappIconLetter, { color: categoryColor }]}>
                {item.dapp.name.charAt(0).toUpperCase()}
              </Text>
            </View>
          )}
          <View style={styles.dappMeta}>
            <Text style={styles.dappName} numberOfLines={1} ellipsizeMode='tail'>
              {item.dapp.name}
            </Text>
            <Text style={styles.dappUrl} numberOfLines={1} ellipsizeMode='middle'>
              {item.dapp.url}
            </Text>
          </View>
        </View>
        <View style={[styles.methodBadge, { backgroundColor: categoryBgColor }]}>
          <Text style={[styles.methodBadgeText, { color: categoryColor }]}>
            {METHOD_LABELS[item.method] || item.method}
          </Text>
        </View>
      </View>
      <View style={styles.cardFooter}>
        <Text style={styles.requestId}>#{item.id}</Text>
        <TouchableOpacity
          style={styles.rejectSingleBtn}
          onPress={() => onReject(item.id, item.topic)}
          activeOpacity={0.7}
        >
          <Text style={styles.rejectSingleText}>{t`Reject`}</Text>
        </TouchableOpacity>
      </View>
    </Animated.View>
  );
};

const EmptyState = ({ navigation }) => (
  <View style={styles.emptyContainer}>
    <View style={styles.emptyIconCircle}>
      <Text style={styles.emptyIcon}>✓</Text>
    </View>
    <Text style={styles.emptyTitle}>{t`All clear!`}</Text>
    <Text style={styles.emptySubtitle}>
      {t`No pending requests from dApps.`}
    </Text>
    <NewHathorButton
      title={t`Go Back`}
      onPress={() => navigation.goBack()}
      wrapperStyle={styles.emptyButton}
    />
  </View>
);

export default function PendingRequests({ navigation }) {
  const dispatch = useDispatch();
  const pendingRequests = useSelector((state) => state.reown.pendingRequests);
  const reownClient = useSelector((state) => state.reown.client);
  const [rejecting, setRejecting] = React.useState(false);
  const rejectTimeoutRef = useRef(null);

  useEffect(() => {
    dispatch(reownFetchPendingRequests());
    return () => {
      if (rejectTimeoutRef.current) {
        clearTimeout(rejectTimeoutRef.current);
      }
    };
  }, [dispatch]);

  const handleRejectAll = useCallback(() => {
    setRejecting(true);
    dispatch(reownRejectAllPendingRequests());
    rejectTimeoutRef.current = setTimeout(() => setRejecting(false), 500);
  }, [dispatch]);

  const handleRejectSingle = useCallback((id, topic) => {
    dispatch(reownRejectPendingRequest(id, topic));
  }, [dispatch]);

  const handleRefresh = useCallback(() => {
    dispatch(reownFetchPendingRequests());
  }, [dispatch]);

  // Group requests by dApp for the summary header
  const dappSummary = React.useMemo(() => {
    const grouped = {};
    pendingRequests.forEach((req) => {
      const key = req.dapp.name;
      if (!grouped[key]) {
        grouped[key] = { name: req.dapp.name, icon: req.dapp.icon, count: 0 };
      }
      grouped[key].count += 1;
    });
    return Object.values(grouped);
  }, [pendingRequests]);

  const renderItem = useCallback(({ item }) => (
    <RequestCard item={item} onReject={handleRejectSingle} />
  ), [handleRejectSingle]);

  const keyExtractor = useCallback((item) => `${item.id}`, []);

  if (!reownClient) {
    return (
      <View style={styles.wrapper}>
        <HathorHeader
          title={t`Pending Requests`}
          onBackPress={() => navigation.goBack()}
        />
        <View style={styles.emptyContainer}>
          <Text style={styles.emptySubtitle}>{t`Reown is not connected.`}</Text>
        </View>
      </View>
    );
  }

  const hasRequests = pendingRequests.length > 0;

  return (
    <View style={styles.wrapper}>
      <HathorHeader
        title={t`Pending Requests`}
        onBackPress={() => navigation.goBack()}
      />

      {!hasRequests ? (
        <EmptyState navigation={navigation} />
      ) : (
        <View style={styles.content}>
          {/* Summary banner */}
          <View style={styles.summaryBanner}>
            <View style={styles.summaryLeft}>
              <View style={styles.countBadge}>
                <Text style={styles.countText}>{pendingRequests.length}</Text>
              </View>
              <View>
                <Text style={styles.summaryTitle}>
                  {pendingRequests.length === 1
                    ? t`pending request`
                    : t`pending requests`}
                </Text>
                <Text style={styles.summarySubtitle}>
                  {dappSummary.length === 1
                    ? t`from ${dappSummary[0].name}`
                    : t`from ${dappSummary.length} dApps`}
                </Text>
              </View>
            </View>
            <TouchableOpacity
              onPress={handleRefresh}
              style={styles.refreshBtn}
              activeOpacity={0.7}
            >
              <Text style={styles.refreshText}>{t`Refresh`}</Text>
            </TouchableOpacity>
          </View>

          {/* Request list */}
          <FlatList
            data={pendingRequests}
            renderItem={renderItem}
            keyExtractor={keyExtractor}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
            ItemSeparatorComponent={() => <View style={styles.separator} />}
          />

          {/* Bottom action bar */}
          <View style={styles.bottomBar}>
            <NewHathorButton
              title={rejecting ? t`Rejecting...` : t`Reject All (${pendingRequests.length})`}
              onPress={handleRejectAll}
              disabled={rejecting}
              danger
              secondary
              wrapperStyle={styles.rejectAllBtn}
            />
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    flex: 1,
    backgroundColor: COLORS.lowContrastDetail,
  },
  content: {
    flex: 1,
  },

  // Summary banner
  summaryBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 16,
    backgroundColor: COLORS.backgroundColor,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.borderColor,
  },
  summaryLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  countBadge: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: COLORS.feedbackError200,
    alignItems: 'center',
    justifyContent: 'center',
  },
  countText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: COLORS.feedbackError600,
  },
  summaryTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: COLORS.textColor,
  },
  summarySubtitle: {
    fontSize: 12,
    color: COLORS.textColorShadowOpacity06,
    marginTop: 2,
  },
  refreshBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    backgroundColor: COLORS.lowContrastDetail,
  },
  refreshText: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.primary,
  },

  // Request list
  listContent: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 16,
  },
  separator: {
    height: 8,
  },

  // Request card
  requestCard: {
    backgroundColor: COLORS.backgroundColor,
    borderRadius: 16,
    paddingVertical: 14,
    paddingHorizontal: 16,
    shadowColor: COLORS.textColor,
    shadowOpacity: 0.06,
    shadowOffset: { height: 2, width: 0 },
    shadowRadius: 8,
    elevation: 2,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  dappInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 8,
  },
  dappIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
  },
  dappIconPlaceholder: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dappIconLetter: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  dappMeta: {
    marginLeft: 10,
    flex: 1,
  },
  dappName: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.textColor,
  },
  dappUrl: {
    fontSize: 11,
    color: COLORS.textColorShadowOpacity06,
    marginTop: 1,
  },
  methodBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  methodBadgeText: {
    fontSize: 11,
    fontWeight: '600',
  },

  // Card footer
  cardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: COLORS.borderColor,
  },
  requestId: {
    fontSize: 11,
    color: COLORS.midContrastDetail,
    fontFamily: 'Courier',
  },
  rejectSingleBtn: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: COLORS.errorBgColor,
  },
  rejectSingleText: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.errorBgColor,
  },

  // Bottom bar
  bottomBar: {
    paddingHorizontal: 16,
    paddingVertical: 16,
    paddingBottom: 32,
    backgroundColor: COLORS.backgroundColor,
    borderTopWidth: 1,
    borderTopColor: COLORS.borderColor,
  },
  rejectAllBtn: {
    borderColor: COLORS.errorBgColor,
  },

  // Empty state
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  emptyIconCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: COLORS.feedbackSuccess100,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  emptyIcon: {
    fontSize: 32,
    color: COLORS.feedbackSuccess400,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: COLORS.textColor,
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 14,
    color: COLORS.textColorShadowOpacity06,
    textAlign: 'center',
    lineHeight: 20,
  },
  emptyButton: {
    marginTop: 24,
    width: '100%',
  },
});
