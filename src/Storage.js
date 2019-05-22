import AsyncStorage from '@react-native-community/async-storage';

global.hathorMemoryStorage = {};
// Creating memory storage to be used in the place of localStorage
export const storageFactory = {
  getItem(key) {
    return global.hathorMemoryStorage[key] || null;
  },

  setItem(key, value) {
    global.hathorMemoryStorage[key] = value;
    AsyncStorage.setItem(key, JSON.stringify(value)).then(() => {
      const allKeys = Object.keys(global.hathorMemoryStorage);
      keysStr = JSON.stringify(allKeys);
      AsyncStorage.setItem("hathorMobileKeys", keysStr);
    });
  },

  removeItem(key) {
    AsyncStorage.removeItem(key);
    delete global.hathorMemoryStorage[key];
  },

  clear() {
    allKeys = Object.keys(global.hathorMemoryStorage);
    AsyncStorage.multiRemove(allKeys);
    global.hathorMemoryStorage = {};
    AsyncStorage.setItem("hathorMobileKeys", "[]");
  },

  key(n) {
    return Object.keys(global.hathorMemoryStorage)[n] || null;
  },

  async rebuild() {
    const keysStr = await AsyncStorage.getItem("hathorMobileKeys");
    if (keysStr) {
      const keys = JSON.parse(keysStr);
      const allValues = await AsyncStorage.multiGet(keys);
      for (const arr of allValues) {
        const key = arr[0];
        const value = JSON.parse(arr[1]);
        global.hathorMemoryStorage[key] = value;
      }
    }
  }
}
