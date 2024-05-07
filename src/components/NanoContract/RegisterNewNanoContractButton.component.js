import React from 'react';
import { t } from 'ttag';
import { useNavigation } from '@react-navigation/native';

import SimpleButton from '../SimpleButton';

export const RegisterNanoContract = () => {
  const navigation = useNavigation();
  const navigatesToRegisterNanoContract = () => {
    navigation.navigate('RegisterNanoContract');
  };

  return (
    <SimpleButton
      title={t`Register new`}
      onPress={navigatesToRegisterNanoContract}
    />
  );
};
