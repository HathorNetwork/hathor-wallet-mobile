/**
 * Copyright (c) Hathor Labs and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import hathorLib from '@hathor/wallet-lib';

/**
 * This file contains all variables a user has to modify if he wants to create
 * an app for his own token. Files should never import them directly (they are
 * prepended with '_'). Instead, constants.js imports and re-exports them.
 */

/**
 * Indicates if app should handle multiple tokens or just one. If it handles just one,
 * some modifications are made to the app:
 * . initial screen is not the dashboard with tokens list, but the default token main screen;
 * . remove register/unregister token options;
 * . remove create new token option;
 */
export const _IS_MULTI_TOKEN = true;

/**
 * Default token.
 *
 * Example config:
 * {
 *   name: 'YanCoin',
 *   symbol: 'YAN',
 *   uid: '000003a3b261e142d3dfd84970d3a50a93b5bc3a66a3b6ba973956148a3eb824'
 * }
 */
export const _DEFAULT_TOKEN = hathorLib.constants.HATHOR_TOKEN_CONFIG;

/**
 * App's primary color (Hathor purple)
 */
export const _PRIMARY_COLOR = '#8C46FF';
