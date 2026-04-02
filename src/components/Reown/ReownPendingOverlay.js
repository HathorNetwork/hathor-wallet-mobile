/**
 * Copyright (c) Hathor Labs and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  StyleSheet,
  View,
  Text,
  Image,
  FlatList,
  Animated,
  TouchableOpacity,
  Dimensions,
  Platform,
} from 'react-native';
import { useSelector, useDispatch } from 'react-redux';
import { t } from 'ttag';
import { Portal } from '../Portal';
import {
  reownRejectAllPendingRequests,
  reownReject,
  setForceNavigateToDashboard,
  hideReownModal,
} from '../../actions';
import { COLORS } from '../../styles/themes';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const CARD_WIDTH = SCREEN_WIDTH - 64;
const CARD_MARGIN = 8;

const METHOD_LABELS = {
  htr_signWithAddress: 'Sign Message',
  htr_sendNanoContractTx: 'Nano Contract Tx',
  htr_signOracleData: 'Sign Oracle Data',
  htr_createToken: 'Create Token',
  htr_sendTransaction: 'Send Transaction',
  htr_createNanoContractCreateTokenTx: 'NC Create Token Tx',
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

const getCategoryStyle = (category) => {
  switch (category) {
    case 'write':
      return {
        color: COLORS.feedbackWarning300,
        bg: COLORS.feedbackWarning100,
      };
    case 'sign':
      return { color: COLORS.primary, bg: COLORS.primaryOpacity10 };
    default:
      return {
        color: COLORS.positiveBalanceColor,
        bg: 'hsla(180, 80%, 95%, 1)',
      };
  }
};

/**
 * A single request card in the carousel.
 */
const RequestCard = ({ item, width }) => {
  const category = getMethodCategory(item.method);
  const catStyle = getCategoryStyle(category);

  return (
    <View style={[styles.card, { width }]}>
      <View style={styles.cardTop}>
        {item.dapp.icon ? (
          <Image
            style={styles.cardDappIcon}
            source={{ uri: item.dapp.icon }}
          />
        ) : (
          <View
            style={[styles.cardDappIconFallback, { backgroundColor: catStyle.bg }]}
          >
            <Text style={[styles.cardDappLetter, { color: catStyle.color }]}>
              {item.dapp.name.charAt(0).toUpperCase()}
            </Text>
          </View>
        )}
        <View style={styles.cardDappMeta}>
          <Text
            style={styles.cardDappName}
            numberOfLines={1}
            ellipsizeMode='tail'
          >
            {item.dapp.name}
          </Text>
          <Text
            style={styles.cardDappUrl}
            numberOfLines={1}
            ellipsizeMode='middle'
          >
            {item.dapp.url}
          </Text>
        </View>
      </View>
      <View style={[styles.methodBadge, { backgroundColor: catStyle.bg }]}>
        <Text style={[styles.methodBadgeText, { color: catStyle.color }]}>
          {METHOD_LABELS[item.method] || item.method}
        </Text>
      </View>
    </View>
  );
};

/**
 * Page indicator dots.
 */
const PageDots = ({ count, activeIndex }) => {
  if (count <= 1) return null;
  const maxDots = 7;
  const showDots = Math.min(count, maxDots);

  return (
    <View style={styles.dotsRow}>
      {Array.from({ length: showDots }).map((_, i) => (
        <View
          // eslint-disable-next-line react/no-array-index-key
          key={i}
          style={[
            styles.dot,
            i === (activeIndex % showDots) && styles.dotActive,
          ]}
        />
      ))}
      {count > maxDots && (
        <Text style={styles.dotsMore}>+{count - maxDots}</Text>
      )}
    </View>
  );
};

/**
 * Global overlay for pending Reown requests.
 *
 * - Renders a floating banner when pendingRequests.length > 1.
 * - Tapping the banner expands into a full-screen carousel overlay.
 * - "Reject All" batch-rejects all pending + the current request.
 */
const ReownPendingOverlay = () => {
  const dispatch = useDispatch();
  const pendingRequests = useSelector(
    (state) => state.reown.pendingRequests
  );
  const count = pendingRequests.length;

  const [expanded, setExpanded] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const bannerAnim = useRef(new Animated.Value(-80)).current;
  const overlayAnim = useRef(new Animated.Value(0)).current;
  const visible = count > 1;

  // Slide banner in/out
  useEffect(() => {
    if (visible) {
      Animated.timing(bannerAnim, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }).start();
    }
  }, [visible, bannerAnim]);

  // Close expanded view when requests are cleared
  useEffect(() => {
    if (!visible) {
      setExpanded(false);
    }
  }, [visible]);

  // Fade overlay in/out
  useEffect(() => {
    Animated.timing(overlayAnim, {
      toValue: expanded ? 1 : 0,
      duration: 250,
      useNativeDriver: true,
    }).start();
  }, [expanded, overlayAnim]);

  const onRejectAll = useCallback(() => {
    dispatch(reownRejectAllPendingRequests());
    // Unblock the currently-processing request saga
    dispatch(reownReject());
    // Close the active Reown modal/detail screen
    dispatch(hideReownModal());
    // Navigate away from the current request detail screen
    dispatch(setForceNavigateToDashboard(true));
    setExpanded(false);
  }, [dispatch]);

  const onViewableItemsChanged = useRef(({ viewableItems }) => {
    if (viewableItems.length > 0) {
      setActiveIndex(viewableItems[0].index || 0);
    }
  }).current;

  const viewabilityConfig = useRef({
    itemVisiblePercentThreshold: 50,
  }).current;

  const renderCard = useCallback(
    ({ item }) => (
      <RequestCard item={item} width={CARD_WIDTH} />
    ),
    []
  );

  const keyExtractor = useCallback((item) => `${item.id}`, []);

  // All hooks above — safe to early-return now
  if (!visible) return null;

  const firstDapp = pendingRequests[0]?.dapp;

  return (
    <Portal>
      {/* Floating banner */}
      <Animated.View
        style={[
          styles.banner,
          { transform: [{ translateY: bannerAnim }] },
        ]}
        pointerEvents='box-none'
      >
        <TouchableOpacity
          style={styles.bannerTouchable}
          onPress={() => setExpanded(true)}
          activeOpacity={0.85}
        >
          <View style={styles.bannerLeft}>
            {firstDapp?.icon ? (
              <Image
                style={styles.bannerIcon}
                source={{ uri: firstDapp.icon }}
              />
            ) : (
              <View style={styles.bannerIconFallback}>
                <Text style={styles.bannerIconLetter}>
                  {firstDapp?.name?.charAt(0)?.toUpperCase() || '?'}
                </Text>
              </View>
            )}
            <View style={styles.bannerTextWrap}>
              <Text style={styles.bannerCount}>{count}</Text>
              <Text style={styles.bannerLabel}>
                {count === 1
                  ? t`pending request`
                  : t`pending requests`}
              </Text>
            </View>
          </View>
          <TouchableOpacity
            onPress={onRejectAll}
            style={styles.bannerRejectBtn}
            activeOpacity={0.7}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Text style={styles.bannerRejectText}>
              {t`REJECT ALL`}
            </Text>
          </TouchableOpacity>
        </TouchableOpacity>
      </Animated.View>

      {/* Expanded carousel overlay */}
      {expanded && (
        <Animated.View
          style={[styles.overlay, { opacity: overlayAnim }]}
        >
          <TouchableOpacity
            style={styles.overlayBackdrop}
            activeOpacity={1}
            onPress={() => setExpanded(false)}
          />
          <Animated.View
            style={[
              styles.overlayContent,
              {
                transform: [
                  {
                    translateY: overlayAnim.interpolate({
                      inputRange: [0, 1],
                      outputRange: [60, 0],
                    }),
                  },
                ],
              },
            ]}
          >
            {/* Header */}
            <Text style={styles.overlayTitle}>
              {count} {t`Pending Requests`}
            </Text>

            {/* Carousel */}
            <FlatList
              data={pendingRequests}
              renderItem={renderCard}
              keyExtractor={keyExtractor}
              horizontal
              pagingEnabled
              snapToInterval={CARD_WIDTH + CARD_MARGIN * 2}
              decelerationRate='fast'
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.carouselContent}
              onViewableItemsChanged={onViewableItemsChanged}
              viewabilityConfig={viewabilityConfig}
              getItemLayout={(_, index) => ({
                length: CARD_WIDTH + CARD_MARGIN * 2,
                offset: (CARD_WIDTH + CARD_MARGIN * 2) * index,
                index,
              })}
            />

            {/* Page dots */}
            <PageDots count={count} activeIndex={activeIndex} />

            {/* Actions */}
            <TouchableOpacity
              style={styles.rejectAllBtn}
              onPress={onRejectAll}
              activeOpacity={0.8}
            >
              <Text style={styles.rejectAllText}>
                {t`REJECT ALL`} ({count})
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.dismissBtn}
              onPress={() => setExpanded(false)}
              activeOpacity={0.7}
            >
              <Text style={styles.dismissText}>{t`Dismiss`}</Text>
            </TouchableOpacity>
          </Animated.View>
        </Animated.View>
      )}
    </Portal>
  );
};

const styles = StyleSheet.create({
  // ── Banner ────────────────────────────────────────
  banner: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 54 : 8,
    left: 12,
    right: 12,
    zIndex: 10000,
  },
  bannerTouchable: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: COLORS.textColor,
    borderRadius: 14,
    paddingVertical: 10,
    paddingHorizontal: 14,
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 12,
    elevation: 8,
  },
  bannerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  bannerIcon: {
    width: 28,
    height: 28,
    borderRadius: 14,
  },
  bannerIconFallback: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  bannerIconLetter: {
    fontSize: 13,
    fontWeight: 'bold',
    color: COLORS.white,
  },
  bannerTextWrap: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginLeft: 10,
    gap: 4,
  },
  bannerCount: {
    fontSize: 16,
    fontWeight: 'bold',
    color: COLORS.white,
  },
  bannerLabel: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.75)',
  },
  bannerRejectBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: COLORS.errorBgColor,
    marginLeft: 8,
  },
  bannerRejectText: {
    fontSize: 11,
    fontWeight: 'bold',
    color: COLORS.white,
    letterSpacing: 0.5,
  },

  // ── Expanded overlay ──────────────────────────────
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 10001,
  },
  overlayBackdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.6)',
  },
  overlayContent: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: COLORS.backgroundColor,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingTop: 24,
    paddingBottom: Platform.OS === 'ios' ? 40 : 24,
    maxHeight: '70%',
  },
  overlayTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: COLORS.textColor,
    textAlign: 'center',
    marginBottom: 20,
  },

  // ── Carousel ──────────────────────────────────────
  carouselContent: {
    paddingHorizontal: 24,
  },

  // ── Card ──────────────────────────────────────────
  card: {
    backgroundColor: COLORS.lowContrastDetail,
    borderRadius: 16,
    padding: 16,
    marginHorizontal: CARD_MARGIN,
  },
  cardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  cardDappIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
  },
  cardDappIconFallback: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardDappLetter: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  cardDappMeta: {
    marginLeft: 12,
    flex: 1,
  },
  cardDappName: {
    fontSize: 15,
    fontWeight: '600',
    color: COLORS.textColor,
  },
  cardDappUrl: {
    fontSize: 12,
    color: COLORS.textColorShadowOpacity06,
    marginTop: 2,
  },
  methodBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  methodBadgeText: {
    fontSize: 13,
    fontWeight: '600',
  },

  // ── Page dots ─────────────────────────────────────
  dotsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 16,
    gap: 6,
  },
  dot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: COLORS.borderColorDark,
  },
  dotActive: {
    backgroundColor: COLORS.textColor,
    width: 18,
    borderRadius: 4,
  },
  dotsMore: {
    fontSize: 11,
    color: COLORS.midContrastDetail,
    marginLeft: 4,
  },

  // ── Actions ───────────────────────────────────────
  rejectAllBtn: {
    marginTop: 20,
    marginHorizontal: 24,
    height: 48,
    borderRadius: 12,
    backgroundColor: COLORS.errorBgColor,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rejectAllText: {
    fontSize: 14,
    fontWeight: 'bold',
    color: COLORS.white,
    letterSpacing: 0.5,
  },
  dismissBtn: {
    marginTop: 12,
    alignItems: 'center',
    paddingVertical: 8,
  },
  dismissText: {
    fontSize: 14,
    color: COLORS.textColorShadow,
  },
});

export default ReownPendingOverlay;
