// This workaround was in App.js before
// however this redux file is loaded before and we need the hathorLib here
import { storageFactory } from './Storage';
global.localStorage = storageFactory;
global.localStorage.memory = true;
global.localStorage.setItem('wallet:server', 'https://node4.alpha.testnet.hathor.network/v1a/');

import '../shim.js'


// Workaround to prevent error when using locale in android
import 'intl';
import 'intl/locale-data/jsonp/en';

const hathorLib = require('@hathor/wallet-lib');
global.hathorLib = hathorLib;


/**
 * Default tokens for the wallet (to start on redux)
 */
export const INITIAL_TOKENS = [global.hathorLib.constants.HATHOR_TOKEN_CONFIG];

/**
 * Default selected token
 */
export const SELECTED_TOKEN = global.hathorLib.constants.HATHOR_TOKEN_CONFIG;