import events from 'events';
import { Platform } from 'react-native';
import { UnleashClient } from 'unleash-proxy-client';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  UNLEASH_URL,
  UNLEASH_CLIENT_KEY,
  UNLEASH_POLLING_INTERVAL,
  STAGE,
} from './constants';

export const Events = {
  WALLET_SERVICE_ENABLED: 'wallet-service-enabled',
  PUSH_NOTIFICATION_ENABLED: 'push-notification-enabled',
};

const UnleashEvent = {
  UPDATE: 'update',
};

export class FeatureFlags extends events.EventEmitter {
  constructor(userId, network) {
    super();

    this.userId = userId;
    this.network = network;
    this.walletServiceFlag = `wallet-service-mobile-${Platform.OS}-${this.network}.rollout`;
    this.walletServiceEnabled = null;
    this.pushNotificationFlag = 'push-notification.rollout';
    this.pushNotificationEnabled = null;
    this.client = new UnleashClient({
      url: UNLEASH_URL,
      clientKey: UNLEASH_CLIENT_KEY,
      refreshInterval: UNLEASH_POLLING_INTERVAL,
      appName: `wallet-service-mobile-${Platform.OS}`,
    });

    this.onUpdateWalletServiceFn = () => this.onUpdateWalletService.bind(this)();
    this.onUpdatePushNotificationFn = () => this.onUpdatePushNotification.bind(this)();
    this.client.on(UnleashEvent.UPDATE, this.onUpdateWalletServiceFn);
    this.client.on(UnleashEvent.UPDATE, this.onUpdatePushNotificationFn);
  }

  async start() {
    try {
      const options = {
        userId: this.userId,
        properties: {
          platform: Platform.OS,
          stage: STAGE,
        },
      };
      this.client.updateContext(options);

      // Start polling for feature flag updates
      await this.client.start();
      return true;
    } catch (error) {
      console.error('Error starting feature flags.', error);
      return false;
    }
  }

  stop() {
    // Stop the client from polling
    this.client.stop();
  }

  /**
   * Emit an event when the wallet service flag is updated.
   * @see Events.WALLET_SERVICE_ENABLED
   * @param {boolean} enabled - The new value for the wallet service flag
   */
  emitWalletServiceEnabledEvent(enabled) {
    this.emit(Events.WALLET_SERVICE_ENABLED, enabled);
  }

  /**
   * Emit an event when the push notification flag is updated.
   * @see Events.PUSH_NOTIFICATION_ENABLED
   * @param {boolean} enabled - The new value for the push notification flag
   */
  emitPushNotificationEnabledEvent(enabled) {
    this.emit(Events.PUSH_NOTIFICATION_ENABLED, enabled);
  }

  /**
   * Handles the update event from unleash client to process the wallet service flag.
   */
  onUpdateWalletService() {
    const walletServiceEnabled = this.client.isEnabled(this.walletServiceFlag);
    // We should only emit an update if we already had a value on the instance
    // and if the value has changed
    if (this.walletServiceEnabled !== null && (
      this.walletServiceEnabled !== walletServiceEnabled
    )) {
      this.walletServiceEnabled = walletServiceEnabled;
      this.emitWalletServiceEnabledEvent(walletServiceEnabled);
    }
  }

  /**
   * Unlistens to the update event for the wallet service flag.
   */
  offUpdateWalletService() {
    this.client.off(UnleashEvent.UPDATE, this.onUpdateWalletServiceFn);
  }

  /**
   * Handles the update event from unleash client to process the push notification flag.
   */
  onUpdatePushNotification() {
    const pushNotificationEnabled = this.client.isEnabled(this.pushNotificationFlag);
    if (this.pushNotificationEnabled !== null && (
      this.pushNotificationEnabled !== pushNotificationEnabled
    )) {
      this.pushNotificationEnabled = pushNotificationEnabled;
      this.emitPushNotificationEnabledEvent(pushNotificationEnabled);
    }
  }

  /**
   * Unlistens to the update event for the push notification flag.
   */
  offUpdatePushNotification() {
    this.client.off(UnleashEvent.UPDATE, this.onUpdatePushNotificationFn);
  }

  /**
  * Uses the Hathor Unleash Server and Proxy to determine if the
  * wallet should use the WalletService facade or the old facade
  *
  * @return {boolean} The result from the unleash feature flag
  */
  async shouldUseWalletService() {
    try {
      const shouldIgnore = await AsyncStorage.getItem('featureFlags:ignoreWalletServiceFlag');
      if (shouldIgnore) {
        this.offUpdateWalletService();
        return false;
      }

      // start() method will have already called the fetchToggles, so the flag should be enabled
      const isWalletServiceEnabled = this.client.isEnabled(this.walletServiceFlag);
      this.walletServiceEnabled = isWalletServiceEnabled;

      return this.walletServiceEnabled;
    } catch (e) {
      // If our feature flag service is unavailable, we default to the
      // old facade
      return false;
    }
  }

  /**
   * Uses the Hathor Unleash Server and Proxy to determine if the
   * wallet should use the push notification feature.
   *
   * @returns {boolean} The result from the unleash feature flag
   */
  shouldUsePushNotification() {
    try {
      const isPushNotificationEnabled = this.client.isEnabled(this.pushNotificationFlag);
      this.pushNotificationEnabled = isPushNotificationEnabled;
      return this.pushNotificationEnabled;
    } catch (error) {
      console.error('Error getting push notification flag.', error);
      // If our feature flag service is unavailable, we default to turn off push notification
      return false;
    }
  }

  /**
   * Sets the ignore flag on the storage to persist it between app restarts.
   * It also unlistens to the update event for the wallet service flag.
   */
  async ignoreWalletServiceFlag() {
    await AsyncStorage.setItem('featureFlags:ignoreWalletServiceFlag', 'true');
    // We don't need to listen to the update event anymore
    this.offUpdateWalletService();
    this.walletServiceEnabled = false;
  }

  /**
   * Removes the ignore flag from the storage
   */
  static async clearIgnoreWalletServiceFlag() {
    await AsyncStorage.removeItem('featureFlags:ignoreWalletServiceFlag');
  }
}
