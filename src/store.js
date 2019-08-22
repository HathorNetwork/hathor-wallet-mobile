import AsyncStorage from '@react-native-community/async-storage';

/**
 * We use AsyncStorage so we can persist data when our app is closed. However, the lib currently
 * supports only a synchronous storage, so we have this cache (hathorMemoryStorage) in front of
 * AsyncStorage. In practice, when the app is open, we always use info from hathorMemoryStorage
 * and also persist it using AsyncStorage. When we close and open the app again, we read data from
 * AsyncStorage to hathorMemoryStorage.
 */
class AsyncStorageStore {
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

  removeItem(key) {
    AsyncStorage.removeItem(key);
    delete this.hathorMemoryStorage[key];
  }

  clear() {
    const allKeys = Object.keys(this.hathorMemoryStorage);
    AsyncStorage.multiRemove(allKeys);
    this.hathorMemoryStorage = {};
  }

  async preStart() {
    let keys = [];
    try {
      keys = await AsyncStorage.getAllKeys();
    } catch (e) {
      // TODO read key error
    }
    const allValues = await AsyncStorage.multiGet(keys);
    for (const arr of allValues) {
      const key = arr[0];
      const value = JSON.parse(arr[1]);
      this.hathorMemoryStorage[key] = value;
    }
  }
}

export default AsyncStorageStore;
