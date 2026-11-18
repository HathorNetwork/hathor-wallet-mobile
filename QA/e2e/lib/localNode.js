/**
 * Copyright (c) Hathor Labs and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

const LOCAL_HOSTS = ['localhost', '127.0.0.1'];

/** Whether a node URL is on this machine, where the kit's privnet runs. */
function isLocalNode(url) {
  try {
    return LOCAL_HOSTS.includes(new URL(url).hostname);
  } catch (e) {
    return false;
  }
}

module.exports = { isLocalNode };
