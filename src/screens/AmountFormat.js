/**
 * Copyright (c) Hathor Labs and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
} from 'react-native';
import { useSelector, useDispatch } from 'react-redux';
import { t } from 'ttag';
import HathorHeader from '../components/HathorHeader';
import { COLORS } from '../styles/themes';
import { STORE } from '../store';
import {
  AMOUNT_FORMAT,
  AMOUNT_FORMAT_DEFAULT,
  AMOUNT_FORMAT_KEY,
} from '../constants';
import { setAmountFormat } from '../actions';
import { compressAmountString } from '../utils';

const PREVIEW_SAMPLE = '0.0000005195';

/**
 * Screen that lets the user pick the wallet-wide amount display format
 * (Expanded or Compressed) and persist it.
 *
 * @param {Object} props
 * @param {Object} props.navigation - React Navigation navigation object
 */
export default function AmountFormat({ navigation }) {
  const dispatch = useDispatch();
  const currentFormat = useSelector((state) => state.amountFormat ?? AMOUNT_FORMAT_DEFAULT);
  const [selectedFormat, setSelectedFormat] = useState(currentFormat);

  const isSaveDisabled = selectedFormat === currentFormat;

  const onSave = () => {
    if (isSaveDisabled) return;
    STORE.setItem(AMOUNT_FORMAT_KEY, selectedFormat);
    dispatch(setAmountFormat(selectedFormat));
    navigation.goBack();
  };

  const previewValue = selectedFormat === AMOUNT_FORMAT.COMPRESSED
    ? compressAmountString(PREVIEW_SAMPLE)
    : PREVIEW_SAMPLE;

  const renderRadioIcon = (isSelected) => (
    <View
      style={[
        styles.radioOuter,
        { borderColor: isSelected ? COLORS.primary : COLORS.borderColorDark },
      ]}
    >
      {isSelected && <View style={styles.radioInner} />}
    </View>
  );

  const renderOption = (format, label, description, showDefaultBadge) => {
    const isSelected = selectedFormat === format;
    return (
      <TouchableOpacity
        activeOpacity={0.7}
        onPress={() => setSelectedFormat(format)}
        style={styles.option}
      >
        {renderRadioIcon(isSelected)}
        <View style={styles.optionTextWrapper}>
          <View style={styles.optionTitleRow}>
            <Text style={styles.optionTitle}>{label}</Text>
            {showDefaultBadge && (
              <View style={styles.defaultBadge}>
                <Text style={styles.defaultBadgeText}>{t`Default`}</Text>
              </View>
            )}
          </View>
          <Text style={styles.optionDescription}>{description}</Text>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      <HathorHeader
        title={t`AMOUNT FORMAT`}
        onBackPress={() => navigation.goBack()}
      />

      <View style={styles.content}>
        <Text style={styles.intro}>
          {t`Choose how amounts are displayed across your wallet. You can change your default anytime.`}
        </Text>

        <View style={styles.card}>
          {renderOption(
            AMOUNT_FORMAT.EXPANDED,
            t`Expanded`,
            t`Standard notation. Leading zeros are written out in full (ex: 0.0000005195).`,
            true,
          )}
          <View style={styles.divider} />
          {renderOption(
            AMOUNT_FORMAT.COMPRESSED,
            t`Compressed`,
            t`Compresses leading zeros into a subscript count for shorter, easier-to-read small values (ex: 0.0₆5195).`,
            false,
          )}
        </View>

        <Text style={styles.previewHeader}>{t`PREVIEW`}</Text>
        <View style={styles.previewPanel}>
          <Text style={styles.previewLabel}>{t`Full amount`}</Text>
          <Text style={styles.previewValue}>{`${previewValue} HTR`}</Text>
        </View>
      </View>

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
              isSaveDisabled ? styles.saveButtonTextDisabled : styles.saveButtonTextActive,
            ]}
          >
            {t`SAVE PREFERENCES`}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.white,
  },
  content: {
    marginHorizontal: 16,
    marginTop: 16,
  },
  intro: {
    fontSize: 14,
    lineHeight: 20,
    color: COLORS.black,
  },
  card: {
    marginTop: 24,
    borderWidth: 1,
    borderColor: COLORS.borderColor,
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 24,
  },
  option: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  optionTextWrapper: {
    flex: 1,
    marginLeft: 16,
  },
  optionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  optionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.black,
  },
  defaultBadge: {
    backgroundColor: COLORS.lowContrastDetail,
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 2,
  },
  defaultBadgeText: {
    fontSize: 12,
    color: COLORS.darkContrastDetail,
  },
  optionDescription: {
    marginTop: 4,
    fontSize: 12,
    lineHeight: 20,
    color: COLORS.midContrastDetail,
  },
  divider: {
    height: 1,
    backgroundColor: COLORS.borderColor,
    marginVertical: 24,
  },
  previewHeader: {
    marginTop: 24,
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.textColorShadow,
  },
  previewPanel: {
    marginTop: 24,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: COLORS.lowContrastDetail,
    borderRadius: 16,
    padding: 16,
  },
  previewLabel: {
    fontSize: 14,
    color: COLORS.darkContrastDetail,
  },
  previewValue: {
    fontSize: 14,
    fontWeight: '500',
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
});
