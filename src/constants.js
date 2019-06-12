// Workaround to prevent error when using locale in android
import 'intl';
import 'intl/locale-data/jsonp/en';

// This workaround was in App.js before
// however this redux file is loaded before and we need the hathorLib here
import AsyncStorageStore from './store';
import hathorLib from '@hathor/wallet-lib';
hathorLib.storage.setStore(new AsyncStorageStore());
hathorLib.storage.setItem('wallet:server', 'https://node4.alpha.testnet.hathor.network/v1a/');


/**
 * Default tokens for the wallet (to start on redux)
 */
export const INITIAL_TOKENS = [hathorLib.constants.HATHOR_TOKEN_CONFIG];

/**
 * Default selected token
 */
export const SELECTED_TOKEN = hathorLib.constants.HATHOR_TOKEN_CONFIG;
