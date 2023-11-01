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
  // If the networkSettings has a walletServiceUrl, then
  // we should run a full check against the mainnet presettings.
  // This is important because the wallet service has precedence
  // over fullnode.
  if (networkSettings.walletServiceUrl) {
    return !isEqual(networkSettings, PRE_SETTINGS_MAINNET);
  }

  // In the absence of walletServiceUrl we can remove wallet
  // service URLs from the equality check against the mainnet
  // presettings.
  const currNetwork = {
    stage: networkSettings.stage,
    network: networkSettings.network,
    nodeUrl: networkSettings.nodeUrl,
    explorerUrl: networkSettings.explorerUrl,
    explorerServiceUrl: networkSettings.explorerServiceUrl,
  };
  const mainnet = {
    stage: PRE_SETTINGS_MAINNET.stage,
    network: PRE_SETTINGS_MAINNET.network,
    nodeUrl: PRE_SETTINGS_MAINNET.nodeUrl,
    explorerUrl: PRE_SETTINGS_MAINNET.explorerUrl,
    explorerServiceUrl: PRE_SETTINGS_MAINNET.explorerServiceUrl,
  };
  return !isEqual(currNetwork, mainnet);
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
