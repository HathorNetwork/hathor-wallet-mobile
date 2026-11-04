/**
 * Copyright (c) Hathor Labs and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

const { execFileSync } = require('child_process');

/**
 * Throws unless adb's device is an emulator. The kit wipes the app's data, and store builds share
 * its app id, so a phone left on USB would lose its wallet. bin/app-on-privnet.sh checks the same.
 */
function assertEmulator(adb) {
  const qemu = execFileSync(adb, ['shell', 'getprop', 'ro.boot.qemu'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
  if (qemu.trim() !== '1') throw new Error('the device is not an emulator');
}

module.exports = { assertEmulator };
