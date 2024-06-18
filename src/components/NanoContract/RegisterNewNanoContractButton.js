/**
 * Copyright (c) Hathor Labs and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import React from 'react';
import { t } from 'ttag';
import { useNavigation } from '@react-navigation/native';

import SimpleButton from '../SimpleButton';

export const RegisterNanoContract = () => {
  const navigation = useNavigation();
  const navigatesToRegisterNanoContract = () => {
    navigation.navigate('NanoContractRegisterScreen');
  };

  return (
    <SimpleButton
      title={t`Register new`}
      onPress={navigatesToRegisterNanoContract}
    />
  );
};
