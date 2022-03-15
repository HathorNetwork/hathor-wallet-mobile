import events from 'events';
import { Platform } from 'react-native';
import { UnleashClient } from 'unleash-proxy-client';
import AsyncStorage from '@react-native-community/async-storage';
import {
  UNLEASH_URL,
  UNLEASH_CLIENT_KEY,
} from './constants';

export class FeatureFlags extends events.EventEmitter {
  constructor(userId, network) {
    super();

    this.userId = userId;
    this.network = network;
    this.walletServiceFlag = `wallet-service-mobile-${Platform.OS}-${this.network}.rollout`;
    this.walletServiceEnabled = null;
    this.client = new UnleashClient({
      url: UNLEASH_URL,
      clientKey: UNLEASH_CLIENT_KEY,
      refreshInterval: 15,
      appName: `wallet-service-mobile-${Platform.OS}`,
    });

    this.client.on('update', () => {
      const walletServiceEnabled = this.client.isEnabled(this.walletServiceFlag);

      if (this.walletServiceEnabled !== null && (
        this.walletServiceEnabled !== walletServiceEnabled
      )) {
        this.walletServiceEnabled = walletServiceEnabled;
        this.emit('wallet-service-enabled', walletServiceEnabled);
      }
    });
  }

  /**
  * Uses the Hathor Unleash Server and Proxy to determine if the
  * wallet should use the WalletService facade or the old facade
  *
  * @params {string} userId An user identifier (e.g. the firstAddress)
  * @params {string} network The network name ('mainnet' or 'testnet')
  *
  * @return {boolean} The result from the unleash feature flag
  */
  async shouldUseWalletService() {
    try {
      const shouldIgnore = await AsyncStorage.getItem('featureFlags:ignoreWalletServiceFlag');
      if (shouldIgnore) {
        return false;
      }
      this.client.updateContext({ userId: this.userId });
      this.client.start();

      await this.client.fetchToggles();

      const isWalletServiceEnabled = this.client.isEnabled(this.walletServiceFlag);

      this.walletServiceEnabled = isWalletServiceEnabled;

      return this.walletServiceEnabled;
    } catch (e) {
      // If our feature flag service is unavailable, we default to the
      // old facade
      return false;
    }
  }

  async ignoreWalletServiceFlag() {
    await AsyncStorage.setItem('featureFlags:ignoreWalletServiceFlag', 'true');
    this.walletServiceEnabled = false;
    // Stop the client from polling
    this.client.stop();
  }

  static async clearIgnoreWalletServiceFlag() {
    await AsyncStorage.removeItem('featureFlags:ignoreWalletServiceFlag');
  }
}
