import { Platform } from 'react-native';
import { UnleashClient } from 'unleash-proxy-client';
import {
  UNLEASH_URL,
  UNLEASH_CLIENT_KEY,
} from './constants';

/**
 * Uses the Hathor Unleash Server and Proxy to determine if the
 * wallet should use the WalletService facade or the old facade
 *
 * @params {string} userId An user identifier (e.g. the firstAddress)
 * @params {string} network The network name ('mainnet' or 'testnet')
 *
 * @return {boolean} The result from the unleash feature flag
 */
export const shouldUseWalletService = async (userId, network) => {
  try {
    const client = new UnleashClient({
      url: UNLEASH_URL,
      clientKey: UNLEASH_CLIENT_KEY,
      refreshInterval: 15,
      appName: `wallet-service-mobile-${Platform.OS}`,
    });

    client.updateContext({ userId });

    await client.fetchToggles();

    const featureFlagName = `wallet-service-mobile-${Platform.OS}-${network}.rollout`;

    return client.isEnabled(featureFlagName);
  } catch (e) {
    // If our feature flag service is unavailable, we default to the
    // old facade
    return false;
  }
};
