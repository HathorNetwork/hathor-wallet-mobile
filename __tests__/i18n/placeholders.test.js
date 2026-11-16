/**
 * Copyright (c) Hathor Labs and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { describe, test, expect } from '@jest/globals';
import fs from 'fs';
import path from 'path';

// The msgids of a catalog, each with the lines that say where it comes from.
function messages(file) {
  const text = fs.readFileSync(file, 'utf-8');
  return text.split('\n\n').map((entry) => {
    const lines = entry.split('\n');
    const parts = [];
    let taking = false;
    for (const line of lines) {
      if (line.startsWith('msgid ')) {
        taking = true;
        parts.push(JSON.parse(line.slice(6)));
      } else if (taking && line.startsWith('"')) {
        parts.push(JSON.parse(line));
      } else if (taking) {
        break;
      }
    }
    return { msgid: parts.join(''), from: lines.filter((line) => line.startsWith('#:')).join(' ') };
  }).filter(({ msgid }) => msgid);
}

describe('the translation catalog', () => {
  // ttag finds a message's translation by its placeholders' names, and a name used twice maps to
  // its last position only: the message can never be found, and shows in English in every
  // language.
  test('has no message that repeats a placeholder name', () => {
    const repeated = messages(path.join(__dirname, '../../locale/texts.pot'))
      .filter(({ msgid }) => {
        const names = [...msgid.matchAll(/\$\{\s*(\w+)\s*\}/g)].map((match) => match[1]);
        return new Set(names).size !== names.length;
      })
      .map(({ msgid, from }) => `${from}: ${msgid}`);
    expect(repeated).toEqual([]);
  });
});
