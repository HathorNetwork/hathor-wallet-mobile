/**
 * Copyright (c) Hathor Labs and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { createIconSetFromIcoMoon } from 'react-native-vector-icons';
import icoMoonConfig from './icon-font.json';

export default createIconSetFromIcoMoon(
  icoMoonConfig,
  'icomoon',
  'tabbar.ttf',
);
