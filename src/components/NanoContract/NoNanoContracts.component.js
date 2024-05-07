import React from 'react';
import { StyleSheet, View, Text, Linking } from 'react-native';
import { t } from 'ttag';

import SimpleButton from '../SimpleButton';
import { RegisterNanoContract } from './RegisterNewNanoContractButton.component';

export const NoNanoContracts = () => {
  const navigatesToDocumentation = () => {
    Linking.openURL('https://docs.hathor.network/explanations/features/nano-contracts/');
  };
  return (
    <View style={styles.wrapper}>
      <Text style={styles.title}>{t`No Nano Contracts`}</Text>
      <Text style={styles.content}>
        {t`You can keep track of your registered Nano Contracts here once you have registered them.`}
        <View style={styles.learnMoreWrapper}>
          <SimpleButton
            containerStyle={styles.learnMoreContainer}
            textStyle={styles.learnMoreText}
            title={t`Learn More.`}
            onPress={navigatesToDocumentation}
          />
        </View>
      </Text>
      <RegisterNanoContract />
    </View>
  )
};

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
