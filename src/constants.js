/**
 * Copyright (c) Hathor Labs and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

// Workaround to prevent error when using locale in android
import 'intl';
import 'intl/locale-data/jsonp/en';

// This workaround was in App.js before
// however this redux file is loaded before and we need the hathorLib here
import hathorLib from '@hathor/wallet-lib';
import AsyncStorageStore from './store';

hathorLib.storage.setStore(new AsyncStorageStore());
hathorLib.storage.setItem('wallet:server', 'https://node2.mainnet.hathor.network/v1a/');
hathorLib.network.setNetwork('mainnet');


/**
 * Indicates if app should handle multiple tokens or just one. If it handles just one,
 * some modifications are made to the app:
 * . initial screen is not the dashboard with tokens list, but the default token main screen;
 * . remove register/unregister token options;
 * . remove create new token option;
 */
export const IS_MULTI_TOKEN = true;

/**
 * Default token
 */
export const DEFAULT_TOKEN = hathorLib.constants.HATHOR_TOKEN_CONFIG;

/**
 * Default tokens for the wallet (to start on redux)
 */
export const INITIAL_TOKENS = [DEFAULT_TOKEN];

/**
 * App's primary color
 */
export const PRIMARY_COLOR = '#8C46FF';   // Hathor purple

/**
 * Light primary color used as background in some cases (varies depending on the opacity)
 */
export const getLightBackground = (alpha) => `'rgba(140, 70, 255, ${alpha})'`;

/**
 * Wallet will lock if app goes to background for more than LOCK_TIMEOUT seconds
 */
export const LOCK_TIMEOUT = 30000; // 30s

/**
 * Username set in keychain. We don't use it currently, but a value needs to be set
 */
export const KEYCHAIN_USER = 'hathor-keychain';

/**
 * URL with more information about token deposit
 */
export const TOKEN_DEPOSIT_URL = 'https://gitlab.com/HathorNetwork/rfcs/blob/master/text/0011-token-deposit.md';
