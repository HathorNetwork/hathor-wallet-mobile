/**
 * Copyright (c) Hathor Labs and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */
import { useSelector } from 'react-redux';
import { isEqual } from 'lodash';
import { t } from 'ttag';
import { AlertUI } from '../../styles/themes';
import { ToplineBar } from '../ToplineBar';
import { PRE_SETTINGS_MAINNET } from '../../constants';

const customNetworkText = t`Custom network`;

function notMainnet(networkSettings) {
  return !isEqual(networkSettings, PRE_SETTINGS_MAINNET);
}

const style = {
  backgroundColor: AlertUI.primaryColor,
  color: AlertUI.dark40Color,
};

export const NetworkStatusBar = () => {
  const getStatusText = (networkSettings) => `${customNetworkText}: ${networkSettings.network}`;
  const networkSettings = useSelector((state) => state.networkSettings);

  return notMainnet(networkSettings) && (
    <ToplineBar style={style} text={getStatusText(networkSettings)} />
  );
};