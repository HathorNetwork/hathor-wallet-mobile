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
  backgroundColor: AlertUI.lightColor,
  color: AlertUI.darkColor,
};

export const NetworkStatusBar = () => {
  const { networkSettings, fullNodeNetworkName } = useSelector((state) => ({
    networkSettings: state.networkSettings,
    fullNodeNetworkName: state.fullNodeNetworkName,
  }));

  const getStatusText = (name) => `${customNetworkText}: ${name}`;

  // Only show the bar if we have a network name and we're not on mainnet
  return fullNodeNetworkName && notMainnet(networkSettings) && (
    <ToplineBar style={style} text={getStatusText(fullNodeNetworkName)} />
  );
};
