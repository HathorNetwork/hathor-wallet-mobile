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
import { ADDRESS_MODE_KEY } from '../constants';
import { setAddressMode, reloadWalletRequested } from '../actions';

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

  const [selectedMode, setSelectedMode] = useState(currentMode || 'multi');
  const [hasTxOutside, setHasTxOutside] = useState(false);
  const [checking, setChecking] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (currentMode) {
      setSelectedMode(currentMode);
    }
  }, [currentMode]);

  useEffect(() => {
    let cancelled = false;

    const checkAddresses = async () => {
      try {
        if (wallet && typeof wallet.hasTxOutsideFirstAddress === 'function') {
          const result = await wallet.hasTxOutsideFirstAddress();
          if (!cancelled) {
            setHasTxOutside(result);
          }
        }
      } catch (e) {
        // If the check fails, we conservatively prevent switching to single mode
        if (!cancelled) {
          setHasTxOutside(true);
        }
      } finally {
        if (!cancelled) {
          setChecking(false);
        }
      }
    };

    checkAddresses();

    return () => {
      cancelled = true;
    };
  }, [wallet]);

  const isSaveDisabled = selectedMode === currentMode;

  const onSave = useCallback(async () => {
    if (isSaveDisabled) return;

    setSaving(true);
    try {
      if (selectedMode === 'single') {
        await wallet.enableSingleAddressMode();
      } else {
        await wallet.enableMultiAddressMode();
      }

      STORE.setItem(ADDRESS_MODE_KEY, selectedMode);
      dispatch(setAddressMode(selectedMode));
      dispatch(reloadWalletRequested());
    } catch (e) {
      Alert.alert(
        t`Error`,
        t`Failed to change address mode. Please try again.`,
      );
    } finally {
      setSaving(false);
    }
  }, [selectedMode, currentMode, wallet, dispatch, isSaveDisabled]);

  const singleDisabled = hasTxOutside;

  const renderRadioIcon = (isSelected, isDisabled) => {
    const outerColor = isDisabled ? '#c4c4c4' : COLORS.primary;
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
    const labelColor = isDisabled ? '#c4c4c4' : COLORS.primary;
    const bodyColor = isDisabled ? '#b0b0b0' : COLORS.black;

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
          'single',
          t`Single Address`,
          t`Your wallet will use only one address (index 0).`,
          t`Easier to manage and compatible with all dApps.`,
          singleDisabled,
        )}
        {renderCard(
          'multi',
          t`Multi Address`,
          t`Your wallet will let you generate multiple addresses.`,
          t`Useful for advanced users.`,
          false,
        )}
      </View>

      {singleDisabled && (
        <View style={styles.warningBanner}>
          <Text style={styles.warningIcon}>
            {'\u26A0'}
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
    backgroundColor: '#fff',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  descriptionContainer: {
    marginHorizontal: 16,
    marginTop: 16,
    width: 341,
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
    color: '#57606a',
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
    backgroundColor: 'rgba(217, 119, 6, 0.2)',
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
    color: '#D97706',
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
    backgroundColor: '#e5e5e5',
  },
  saveButtonActive: {
    backgroundColor: COLORS.black,
  },
  saveButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
  saveButtonTextDisabled: {
    color: '#737373',
  },
  saveButtonTextActive: {
    color: '#fff',
  },
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
    alignItems: 'center',
  },
  bottomSheet: {
    width: 343,
    backgroundColor: '#fff',
    borderRadius: 8,
    paddingVertical: 24,
    paddingHorizontal: 16,
    alignItems: 'center',
    marginBottom: 32,
  },
  handleBar: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#ccc',
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
