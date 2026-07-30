/**
 * Copyright (c) Hathor Labs and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import React, { useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useSelector, useDispatch } from 'react-redux';
import { t } from 'ttag';
import HathorHeader from '../components/HathorHeader';
import { RadioGroup } from '../components/Radio';
import NewHathorButton from '../components/NewHathorButton';
import { COLORS } from '../styles/themes';
import { STORE } from '../store';
import {
  AMOUNT_FORMAT,
  AMOUNT_FORMAT_DEFAULT,
  AMOUNT_FORMAT_KEY,
  DEFAULT_TOKEN,
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
  const nativeTokenSymbol = useSelector(
    (state) => state.serverInfo?.native_token?.symbol ?? DEFAULT_TOKEN.symbol
  );
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

        <View style={styles.groupWrapper}>
          <RadioGroup
            value={selectedFormat}
            onChange={setSelectedFormat}
            options={[
              {
                value: AMOUNT_FORMAT.EXPANDED,
                title: t`Expanded`,
                description: t`Standard notation. Leading zeros are written out in full (ex: 0.0000005195).`,
                badge: t`Default`,
              },
              {
                value: AMOUNT_FORMAT.COMPRESSED,
                title: t`Compressed`,
                description: t`Compresses leading zeros into a subscript count for shorter, easier-to-read small values (ex: 0.0₆5195).`,
              },
            ]}
          />
        </View>

        <Text style={styles.previewHeader}>{t`PREVIEW`}</Text>
        <View style={styles.previewPanel}>
          <Text style={styles.previewLabel}>{t`Full amount`}</Text>
          <Text style={styles.previewValue}>{`${previewValue} ${nativeTokenSymbol}`}</Text>
        </View>
      </View>

      <View style={styles.bottomSpacer} />

      <View style={styles.buttonContainer}>
        <NewHathorButton
          title={t`Save preferences`}
          onPress={onSave}
          disabled={isSaveDisabled}
        />
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
  groupWrapper: {
    marginTop: 24,
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
});
