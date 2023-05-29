/**
 * Copyright (c) Hathor Labs and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import CryptoJS from 'crypto-js';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { MemoryStore, Storage, cryptoUtils, walletUtils } from '@hathor/wallet-lib';
import { NETWORK } from './constants';


const ACCESS_DATA_KEY = 'asyncstorage:access';
const STORE_VERSION_KEY = 'asyncstorage:version';

class HybridStore extends MemoryStore {
  /**
   * Save access data on our AsyncStorageStore.
   * @param {IWalletAccessData} data Access data to save
   * @async
   * @returns {Promise<void>}
   */
  async saveAccessData(data) {
    STORE.setItem(ACCESS_DATA_KEY, data);
  }

  /**
   * Fetch wallet access data on storage if present.
   * @async
   * @returns {Promise<IWalletAccessData | null>} A promise with the wallet access data.
   */
  async getAccessData() {
    return STORE.getItem(ACCESS_DATA_KEY);
  }
}

/**
 * We use AsyncStorage to persist access data when our app is closed since the
 * wallet-lib does not have a way to choose the persisted wallet as a loaded
 * wallet we use this external storage as a temporary solution to persist access
 * data so we can start the wallet.
 *
 * While we can use the wallet-lib for this we would still need to use this storage
 * if we want to migrate from previous versions of the wallet-lib since the access data
 * was stored in the AsyncStorage.
 */
class AsyncStorageStore {
  _storage = null;

  version = 1;

  constructor() {
    this.hathorMemoryStorage = {};
  }

  getItem(key) {
    const ret = this.hathorMemoryStorage[key];
    if (ret === undefined) {
      return null;
    }
    return ret;
  }

  setItem(key, value) {
    this.hathorMemoryStorage[key] = value;
    AsyncStorage.setItem(key, JSON.stringify(value));
  }

  /**
   * Clear all items from AsyncStorage.
   * Optionally we can erase only the wallet keys.
   * This will keep biometry keys and notification keys for example.
   *
   * @param {boolean} [onlyWalletKeys=false] If true, will delete only keys starting with 'wallet'
   * @returns {Promise<void>}
   */
  async clearItems(onlyWalletKeys = false) {
    const keys = await AsyncStorage.getAllKeys() || [];
    this.hathorMemoryStorage = {};
    if (onlyWalletKeys) {
      await AsyncStorage.multiRemove(keys.filter((key) => key.startsWith('wallet:')));
    } else {
      await AsyncStorage.multiRemove(keys);
    }
  }

  /**
   * Check if the wallet is loaded.
   * Only works after preload is called and hathorMemoryStorage is populated.
   *
   * @returns {boolean} Whether we have a loaded wallet on the storage.
   */
  async walletIsLoaded() {
    const { accessData } = await this.getAvailableAccessData();
    return !!accessData;
  }

  /**
   * Generate accessData, save walletId and prepare storage.
   * @param {string} seed - Words used to generate wallet
   * @param {string} pin - Will be used as pin and password
   */
  async initStorage(seed, pin) {
    // Remove old storage if it exists
    this._storage = null;
    const accessData = walletUtils.generateAccessDataFromSeed(
      seed,
      {
        pin,
        password: pin,
        networkName: NETWORK,
      },
    );
    const storage = this.getStorage();
    await storage.saveAccessData(accessData);
  }

  /**
   * Get a Storage instance for the loaded wallet.
   * @returns {Storage} Storage instance if the wallet is loaded.
   */
  getStorage() {
    if (!this._storage) {
      const store = new HybridStore();
      this._storage = new Storage(store);
    }
    return this._storage;
  }

  /**
   * Get access data of loaded wallet from async storage.
   *
   * @returns {IWalletAccessData|null}
   */
  async _getAccessData() {
    const storage = this.getStorage();
    return await storage.getAccessData();
  }

  /**
   * Will attempt to load the access data from either the old or new storage.
   * This will return the access data as it was found, so the format will be different.
   * To check which format was received, use the storage version that is returned.
   *
   * @returns {Promise<{
   *   accessData: IWalletAccessData|null,
   *   version: number
   * }>} The access data and the storage version.
   */
  async getAvailableAccessData() {
    // First we try to fetch the old access data (if we haven't migrated yet)
    let accessData = this.getItem('wallet:accessData');
    if (!accessData) {
      // If we don't have the old access data, we try to fetch the new one
      accessData = await this._getAccessData();
    }

    // Since each access data has a different interface, we also send the version
    // so the caller can know which one to use
    return { accessData, version: this.getStorageVersion() };
  }

  /**
   * Get the seed of the loaded wallet.
   * @throws {Error} If the words cannot be decrypted.
   * @param {string} pin
   * @returns {Promise<string|null>} Seed of the loaded wallet.
   */
  async getWalletWords(pin) {
    const accessData = await this._getAccessData();
    if (!accessData) {
      return null;
    }
    return cryptoUtils.decryptData(accessData.words, pin);
  }

  /**
   * Get old wallet words if possible.
   *
   * Will attempt to decrypt wallet words encrypted with previous versions of the lib.
   * The encryption method is not the same but uses the same lib (CryptoJS) so we can
   * decrypt without another dependency or utility.
   *
   * @throws {Error} If the words cannot be decrypted.
   * @param {string} pin
   * @return {string|null}
   */
  getOldWalletWords(pin) {
    // This will attempt to fetch the access data in the old format
    const accessData = this.getItem('wallet:accessData');
    if (!accessData) {
      return null;
    }

    // decrypt words with the old method so we can load the wallet
    // when first starting after a version update
    // This should only be necessary when migrating from wallet-lib v0.* to v1.*
    const decryptedWords = CryptoJS.AES.decrypt(accessData.words, pin);
    return decryptedWords.toString(CryptoJS.enc.Utf8);
  }

  /**
   * Get decrypted account path xprivkey.
   * @param {string} pin Pin to decrypt data.
   * @returns {string}
   */
  async getAccountPathKey(pin) {
    const accessData = await this._getAccessData();
    if (!(accessData && accessData.acctPathKey)) {
      return null;
    }

    return cryptoUtils.decryptData(accessData.acctPathKey, pin);
  }

  /**
   * Get decrypted main xprivkey.
   * mainKey should be derived to change path: m/44'/280'/0'/0
   * @param {string} pin Pin to decrypt data.
   * @returns {string}
   */
  async getMainKey(pin) {
    const accessData = await this._getAccessData();
    if (!(accessData && accessData.mainKey)) {
      return null;
    }

    return cryptoUtils.decryptData(accessData.mainKey, pin);
  }

  /**
   * Get the storage version.
   * @returns {number|null} Storage version if it exists on AsyncStorage.
   */
  getStorageVersion() {
    return this.getItem(STORE_VERSION_KEY);
  }

  /**
   * Update the storage version to the most recent one.
   */
  updateStorageVersion() {
    this.setItem(STORE_VERSION_KEY, this.version);
  }

  /**
   * Remove a key from AsyncStorage and from memory.
   * @param {string} key Item to remove.
   */
  removeItem(key) {
    AsyncStorage.removeItem(key);
    delete this.hathorMemoryStorage[key];
  }

  async preStart() {
    // XXX: this is probably not necessary anymore since we delete all wallet keys,
    // but we'll keep it for now
    // Old wallet storage had wallet:data saved, which was causing crash in some phones
    // We've fixed it, so we don't save it on storage anymore but we still need to clean it
    await AsyncStorage.removeItem('wallet:data');

    const keys = await AsyncStorage.getAllKeys() || [];

    const allValues = await AsyncStorage.multiGet(keys);
    for (const arr of allValues) {
      const key = arr[0];
      const value = JSON.parse(arr[1]);

      this.hathorMemoryStorage[key] = value;
    }
  }
}

export const STORE = new AsyncStorageStore();
export default AsyncStorageStore;
