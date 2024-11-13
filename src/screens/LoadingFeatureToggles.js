/**
 * Copyright (c) Hathor Labs and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { View, Text } from 'react-native';
import { t } from 'ttag';
import Spinner from '../components/Spinner';

export function LoadingFeatureToggles() {
  return (
    <View
      style={{
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Text>{t`Loading...`}</Text>
      <Spinner size={48} animating />
    </View>
  );
}
