global.hathorMemoryStorage = {};
// Creating memory storage to be used in the place of localStorage
export const storageFactory = {
  getItem(key) {
    return global.hathorMemoryStorage[key] || null;
  },

  setItem(key, value) {
    global.hathorMemoryStorage[key] = value;
  },

  removeItem(key) {
    delete global.hathorMemoryStorage[key];
  },

  clear() {
    global.hathorMemoryStorage = {};
  },

  key(n) {
   return Object.keys(global.hathorMemoryStorage)[n] || null;
  },
}
