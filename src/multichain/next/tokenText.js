/**
 * Copyright (c) Hathor Labs and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

// Control and direction characters, which can make a name read as another.
// eslint-disable-next-line no-control-regex
const CONTROL_CHARACTERS = /[\u0000-\u001f\u007f-\u009f\u200b-\u200f\u202a-\u202e\u2066-\u2069]/g;

/**
 * A token's name or symbol as anyone may have written it, made safe to show: a string, without
 * control or direction characters, cut to the protocol's cap at a whole character. Null when
 * nothing is left.
 *
 * @param {*} text
 * @param {number} maxBytes
 * @returns {string|null}
 */
export function tokenText(text, maxBytes) {
  if (typeof text !== 'string') {
    return null;
  }
  const encoder = new TextEncoder();
  const clean = text.replace(CONTROL_CHARACTERS, '').trim();
  // Whole characters, while they fit: one pass, however long the text a backend sends.
  let bytes = 0;
  let cut = '';
  for (const char of clean) {
    bytes += encoder.encode(char).length;
    if (bytes > maxBytes) {
      break;
    }
    cut += char;
  }
  return cut || null;
}
