/**
 * Copyright (c) Hathor Labs and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Modal,
  Alert,
} from 'react-native';
import { useSelector, useDispatch } from 'react-redux';
import { t } from 'ttag';
import HathorHeader from '../components/HathorHeader';
import { COLORS } from '../styles/themes';
import { STORE } from '../store';
import { ADDRESS_MODE, addressModeKey } from '../constants';
import { setAddressMode, reloadWalletRequested, onExceptionCaptured } from '../actions';
import { getNetworkSettings } from '../sagas/helpers';
import { WALLET_STATUS } from '../sagas/wallet';
import { logger } from '../logger';

const log = logger('AddressMode');

/**
 * Checks whether the wallet has any tx on addresses past index 0.
 * Returns true conservatively when the underlying call throws, so the
 * caller can prevent switching to single-address mode without proof
 * that no other addresses are in use.
 *
 * @param {Object} wallet - Hathor wallet instance
 * @param {Function} dispatch - Redux dispatch (for exception capture)
 * @returns {Promise<boolean>}
 */
async function detectTxOutsideFirstAddress(wallet, dispatch) {
  try {
    return await wallet.hasTxOutsideFirstAddress();
  } catch (e) {
    log.error('hasTxOutsideFirstAddress check failed', e);
    dispatch(onExceptionCaptured(e, false));
    return true;
  }
}

/**
 * Screen that allows the user to toggle between single and multi address mode.
 *
 * @param {Object} props
 * @param {Object} props.navigation - React Navigation navigation object
 */
export default function AddressMode({ navigation }) {
  const dispatch = useDispatch();
  const wallet = useSelector((state) => state.wallet);
  const currentMode = useSelector((state) => state.addressMode);
  const network = useSelector((state) => getNetworkSettings(state).network);
  const walletStartState = useSelector((state) => state.walletStartState);

  const [selectedMode, setSelectedMode] = useState(currentMode);
  const [hasTxOutside, setHasTxOutside] = useState(false);
  const [checking, setChecking] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (currentMode) {
      setSelectedMode(currentMode);
    }
  }, [currentMode]);

  useEffect(() => {
    // Wait until the wallet is fully ready AND the saga has populated
    // currentMode (the post-start sync in startWallet writes Redux +
    // AsyncStorage with the wallet-lib's actual scan policy).
    if (!wallet || walletStartState !== WALLET_STATUS.READY || currentMode == null) {
      setChecking(true);
      return undefined;
    }

    let cancelled = false;
    setChecking(true);
    detectTxOutsideFirstAddress(wallet, dispatch).then((result) => {
      if (!cancelled) {
        setHasTxOutside(result);
        setChecking(false);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [wallet, walletStartState, currentMode, dispatch]);

  const isSaveDisabled = selectedMode === currentMode;

  const onSave = useCallback(async () => {
    if (isSaveDisabled) return;

    setSaving(true);
    try {
      if (selectedMode === ADDRESS_MODE.SINGLE) {
        await wallet.enableSingleAddressMode();
      } else {
        await wallet.enableMultiAddressMode();
      }

      // Persist optimistically. The saga's post-start sync (startWallet)
      // overwrites this value after reload with the wallet-lib's
      // authoritative scan policy — the lib may silently changes
      // SINGLE → GAP_LIMIT if it detects tx on addresses past index 0.
      STORE.setItem(addressModeKey(network), selectedMode);
      dispatch(setAddressMode(selectedMode));
      dispatch(reloadWalletRequested());
    } catch (e) {
      log.error('Failed to change address mode', e);
      dispatch(onExceptionCaptured(e, false));
      Alert.alert(
        t`Error`,
        t`Failed to change address mode. Please try again.`,
      );
    } finally {
      setSaving(false);
    }
  }, [selectedMode, wallet, dispatch, isSaveDisabled, network]);

  const singleDisabled = hasTxOutside;

  const renderRadioIcon = (isSelected, isDisabled) => {
    const outerColor = isDisabled ? COLORS.borderColorDark : COLORS.primary;
    return (
      <View
        style={[
          styles.radioOuter,
          { borderColor: outerColor },
        ]}
      >
        {isSelected && !isDisabled && (
          <View style={styles.radioInner} />
        )}
      </View>
    );
  };

  const renderCard = (mode, label, body, hint, isDisabled) => {
    const isSelected = selectedMode === mode;
    const labelColor = isDisabled ? COLORS.borderColorDark : COLORS.primary;
    const bodyColor = isDisabled ? COLORS.midContrastDetail : COLORS.black;

    return (
      <TouchableOpacity
        activeOpacity={isDisabled ? 1 : 0.7}
        onPress={() => {
          if (!isDisabled) {
            setSelectedMode(mode);
          }
        }}
        style={styles.card}
        disabled={isDisabled}
      >
        <View style={styles.cardHeader}>
          {renderRadioIcon(isSelected, isDisabled)}
          <Text style={[styles.cardLabel, { color: labelColor }]}>
            {label}
          </Text>
        </View>
        <Text style={[styles.cardBody, { color: bodyColor }]}>
          {body}
        </Text>
        <Text style={styles.cardHint}>
          {hint}
        </Text>
      </TouchableOpacity>
    );
  };

  if (checking) {
    return (
      <View style={styles.container}>
        <HathorHeader
          title={t`ADDRESS MODE`}
          onBackPress={() => navigation.goBack()}
        />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size='large' color={COLORS.primary} />
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <HathorHeader
        title={t`ADDRESS MODE`}
        onBackPress={() => navigation.goBack()}
      />

      <View style={styles.descriptionContainer}>
        <Text style={styles.descriptionText}>
          {t`You can set your wallet to `}
          <Text style={styles.descriptionBold}>
            {t`single or multi address mode`}
          </Text>
          .
        </Text>
        <Text style={styles.descriptionText}>
          {t`You can switch anytime in the settings.`}
        </Text>
      </View>

      <View style={styles.cardsContainer}>
        {renderCard(
          ADDRESS_MODE.SINGLE,
          t`Single Address`,
          t`Your wallet will use only one address (index 0).`,
          t`Easier to manage and compatible with all dApps.`,
          singleDisabled,
        )}
        {renderCard(
          ADDRESS_MODE.MULTI,
          t`Multi Address`,
          t`Your wallet will let you generate multiple addresses.`,
          t`Useful for advanced users.`,
          false,
        )}
      </View>

      {singleDisabled && (
        <View style={styles.warningBanner}>
          <Text style={styles.warningIcon}>
            ⚠
          </Text>
          <Text style={styles.warningText}>
            {t`You can't switch to single address mode because other addresses in your wallet are already in use.`}
          </Text>
        </View>
      )}

      <View style={styles.bottomSpacer} />

      <View style={styles.buttonContainer}>
        <TouchableOpacity
          style={[
            styles.saveButton,
            isSaveDisabled ? styles.saveButtonDisabled : styles.saveButtonActive,
          ]}
          onPress={onSave}
          disabled={isSaveDisabled}
        >
          <Text
            style={[
              styles.saveButtonText,
              isSaveDisabled
                ? styles.saveButtonTextDisabled
                : styles.saveButtonTextActive,
            ]}
          >
            {t`SAVE PREFERENCES`}
          </Text>
        </TouchableOpacity>
      </View>

      <Modal
        visible={saving}
        transparent
        animationType='fade'
        statusBarTranslucent
      >
        <View style={styles.overlay}>
          <View style={styles.bottomSheet}>
            <View style={styles.handleBar} />
            <ActivityIndicator
              size='large'
              color={COLORS.primary}
              style={styles.bottomSheetSpinner}
            />
            <Text style={styles.bottomSheetText}>
              {t`Changing\naddress mode...`}
            </Text>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.white,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  descriptionContainer: {
    marginHorizontal: 16,
    marginTop: 16,
  },
  descriptionText: {
    fontSize: 14,
    lineHeight: 20,
    color: COLORS.black,
  },
  descriptionBold: {
    fontWeight: 'bold',
  },
  cardsContainer: {
    marginHorizontal: 16,
    marginTop: 16,
    gap: 16,
  },
  card: {
    backgroundColor: COLORS.lowContrastDetail,
    minHeight: 122,
    paddingHorizontal: 16,
    paddingVertical: 24,
    borderRadius: 16,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 8,
  },
  cardLabel: {
    fontWeight: 'bold',
    fontSize: 14,
  },
  cardBody: {
    fontSize: 12,
    lineHeight: 20,
  },
  cardHint: {
    fontSize: 12,
    fontStyle: 'italic',
    color: COLORS.darkContrastDetail,
    lineHeight: 20,
  },
  radioOuter: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    justifyContent: 'center',
    alignItems: 'center',
  },
  radioInner: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: COLORS.primary,
  },
  warningBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.feedbackWarning100,
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginHorizontal: 16,
    marginTop: 16,
    gap: 8,
  },
  warningIcon: {
    fontSize: 20,
    width: 20,
    height: 20,
    textAlign: 'center',
    color: COLORS.feedbackWarning300,
  },
  warningText: {
    flex: 1,
    fontSize: 12,
    color: COLORS.black,
  },
  bottomSpacer: {
    flex: 1,
  },
  buttonContainer: {
    marginHorizontal: 16,
    marginBottom: 32,
  },
  saveButton: {
    borderRadius: 8,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveButtonDisabled: {
    backgroundColor: COLORS.borderColorMid,
  },
  saveButtonActive: {
    backgroundColor: COLORS.black,
  },
  saveButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
  saveButtonTextDisabled: {
    color: COLORS.darkContrastDetail,
  },
  saveButtonTextActive: {
    color: COLORS.white,
  },
  overlay: {
    flex: 1,
    backgroundColor: COLORS.textColorShadow,
    justifyContent: 'flex-end',
    alignItems: 'center',
  },
  bottomSheet: {
    width: '100%',
    maxWidth: 343,
    backgroundColor: COLORS.white,
    borderRadius: 8,
    paddingVertical: 24,
    paddingHorizontal: 16,
    alignItems: 'center',
    marginBottom: 32,
    marginHorizontal: 16,
  },
  handleBar: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: COLORS.borderColorDark,
    marginBottom: 24,
  },
  bottomSheetSpinner: {
    marginBottom: 16,
  },
  bottomSheetText: {
    fontSize: 18,
    textAlign: 'center',
    color: COLORS.black,
  },
});
