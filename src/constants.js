// Workaround to prevent error when using locale in android
import 'intl';
import 'intl/locale-data/jsonp/en';

// This workaround was in App.js before
// however this redux file is loaded before and we need the hathorLib here
import hathorLib from '@hathor/wallet-lib';
import AsyncStorageStore from './store';

hathorLib.storage.setStore(new AsyncStorageStore());
hathorLib.storage.setItem('wallet:server', 'https://node2.bravo.testnet.hathor.network/v1a/');


/**
 * Default tokens for the wallet (to start on redux)
 */
export const INITIAL_TOKENS = [hathorLib.constants.HATHOR_TOKEN_CONFIG];

/**
 * Default selected token
 */
export const SELECTED_TOKEN = hathorLib.constants.HATHOR_TOKEN_CONFIG;

/**
 * Wallet will lock if app goes to background for more than LOCK_TIMEOUT seconds
 */
export const LOCK_TIMEOUT = 30000; // 30s


/**
 * Username set in keychain. We don't use it currently, but a value needs to be set
 */
export const KEYCHAIN_USER = 'hathor-keychain';
