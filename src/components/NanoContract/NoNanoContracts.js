/**
 * Copyright (c) Hathor Labs and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import React from 'react';
import { StyleSheet, View, Text } from 'react-native';
import { t } from 'ttag';

import { RegisterNanoContract } from './RegisterNewNanoContractButton';

export const NoNanoContracts = () => (
  <View style={styles.wrapper}>
    <Text style={styles.title}>{t`No Nano Contracts`}</Text>
    <Text style={styles.content}>
      {t`You can keep track of your registered Nano Contracts here once you have registered them.`}
    </Text>
    <RegisterNanoContract />
  </View>
);

const styles = StyleSheet.create({
  wrapper: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 45,
    /* Play the role of a minimum vertical padding for small screens */
    paddingVertical: 90,
  },
  title: {
    fontSize: 16,
    lineHeight: 20,
    fontWeight: 'bold',
    paddingBottom: 16,
  },
  content: {
    fontSize: 14,
    lineHeight: 20,
    paddingBottom: 16,
    textAlign: 'center',
  },
  learnMoreWrapper: {
    display: 'inline-block',
    /* We are using negative margin here to correct the text position
     * and create an optic effect of alignment. */
    marginBottom: -4,
    paddingLeft: 2,
  },
  learnMoreContainer: {
    justifyContent: 'flex-start',
    borderBottomWidth: 1,
  },
  learnMoreText: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: 'bold',
    color: 'black',
  },
});
