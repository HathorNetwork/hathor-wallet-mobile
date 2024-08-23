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
 * @constant
 * @type {{
 *   uid: string;
 *   name: string;
 *   symbol: string;
 * }}
 * @default
 * {
 *   name: 'Hathor',
 *   symbol: 'HTR',
 *   uid: '00'
 * }
 */
export const _DEFAULT_TOKEN = {
  uid: hathorLib.constants.NATIVE_TOKEN_UID,
  ...hathorLib.constants.DEFAULT_NATIVE_TOKEN_CONFIG,
};

export const DEFAULT_EVENT_TOKEN = {
  uid: '00000008ff7c8af2f3ea120b7a3bab5788f917d320ccc98098445bc1ef78ecca',
  name: 'EventCoin',
  symbol: 'EVC',
};

/**
 * App's primary color (Hathor purple)
 */
export const _PRIMARY_COLOR = '#8C46FF';

/**
 * Sentry DSN to send errors
 */
export const _SENTRY_DSN = 'https://c1ebae9159f741e8937abdbfbeba8e8a@o239606.ingest.sentry.io/5304101';
