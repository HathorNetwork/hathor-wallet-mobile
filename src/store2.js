/**
 * Copyright (c) Hathor Labs and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import CryptoJS from 'crypto-js';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { LevelDBStore, cryptoUtils } from '@hathor/wallet-lib';

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
  _accessData = null;

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

  async clearItems(onlyWalletKeys = false) {
    const keys = await AsyncStorage.getAllKeys() || [];
    const ps = [];
    this.hathorMemoryStorage = {};
    for (let index = 0; index < keys.length; index += 1) {
      const key = keys[index];
      if (onlyWalletKeys && !key.startsWith('wallet')) {
        // Skip keys not starting with wallet prefix
        // since we want to delete only wallet keys
        continue;
      }
      ps.push(AsyncStorage.removeItem(key));
    }

    await Promise.all(ps);
  }

  /**
   * Check if the wallet is loaded.
   * Only works after preload is called and hathorMemoryStorage is populated.
   *
   * @returns {boolean} Whether we have a loaded wallet on the storage.
   */
  walletIsLoaded() {
    // This will also work on wallets loaded on previous versions
    // The migration method to load with the new storage scheme will begin
    // after the user inputs the pin on the PinScreen.
    // Another key for wallet:version will be added marking that the wallet:accessData
    // was already loaded for the current storage.
    //
    // This is why we can return true if the wallet is loaded with either version of the storage.
    return !!this.getAccessData();
  }

  saveWalletId(accessData) {
    // Wallet id is the sha256d of the change path xpubkey
    const walletId = CryptoJS.SHA256(CryptoJS.SHA256(accessData.xpubkey)).toString();
    this.setItem('wallet:id', walletId);
  }

  getStorage() {
    if (!this._storage) {
      const walletId = this.getItem('wallet:id');
      if (!walletId) {
        return null;
      }

      this._storage = new LevelDBStore(walletId);
    }
    return this._storage;
  }

  /**
   * Get access data of loaded wallet from async storage.
   *
   * @returns {IWalletAccessData|null}
   */
  async getAccessData() {
    const storage = this.getStorage();
    if (!storage) {
      return null;
    }

    try {
      return await storage.getAccessData();
    } catch (err) {
      // If the storage exists but has not yet been initialized with an access data
      // the getAccessData method will throw an error
      return null;
    }
  }

  /**
   * Save the current access data and storage version.
   *
   * The storage version is meant to be used as a migration index since we arecurrently
   * handling all migration cases in the same method
   * see `src/screens/PinScreen:handleMigration`
   * We should have atomic migrations and a way to identify which migrations are
   * required to have the storage work with the current wallet version.
   *
   * @param { IWalletAccessData } accessData
   */
  saveAccessData(accessData) {
    this.setItem('wallet:accessData', accessData);
    // Saves the current storage version to make migrations easier in the future
    this.setItem('wallet:version', this.version);
  }

  async getWalletWords(pin) {
    const accessData = await this.getAccessData();
    return cryptoUtils.decryptData(accessData.words, pin);
  }

  /**
   * Get wallet words if the wallet is loaded.
   *
   * Will attempt to decrypt wallet words encrypted with previous versions of the lib.
   * The encryption method is not the same but uses the same lib (CryptoJS) so we can
   * decrypt without another dependency or utility.
   *
   * @param {string} pin
   * @return {string|null}
   */
  getOldWalletWords(pin) {
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
    const accessData = await this.getAccessData();
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
  getMainKey(pin) {
    const accessData = this.getAccessData();
    if (!(accessData && accessData.mainKey)) {
      return null;
    }

    return cryptoUtils.decryptData(accessData.mainKey, pin);
  }

  /**
   * Since pin and password are the same in this wallet we can check both pin and password
   * with the same method, the words and mainKey should always be present.
   *
   * @param {string} pin
   * @returns {boolean} If the pin was used to encrypt the data on the store.
   */
  checkPinAndPasswordOnStore(pin) {
    const accessData = this.getAccessData();
    const isPasswordOk = cryptoUtils.checkPassword(accessData.words, pin);
    const isPinOk = cryptoUtils.checkPassword(accessData.mainKey, pin);
    return isPinOk && isPasswordOk;
  }

  removeItem(key) {
    AsyncStorage.removeItem(key);
    delete this.hathorMemoryStorage[key];
  }

  async preStart() {
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

export default AsyncStorageStore;
