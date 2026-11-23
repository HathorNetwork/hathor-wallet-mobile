/**
 * Copyright (c) Hathor Labs and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { jest, describe, test, expect, afterEach } from '@jest/globals';
import { logger } from '../src/logger';

afterEach(() => {
  jest.restoreAllMocks();
});

describe('logger', () => {
  // A method the logger lacks throws where it is called, and takes the caller's own handling down
  // with it.
  test.each(['log', 'debug', 'warn'])('%s writes to the console method of its name, under its scope', (method) => {
    const write = jest.spyOn(console, method).mockImplementation(() => {});

    logger('a-scope')[method]('a message');

    expect(write).toHaveBeenCalledWith('[a-scope] a message');
  });

  test('error writes to console.error, with the error as it is', () => {
    const write = jest.spyOn(console, 'error').mockImplementation(() => {});
    const e = new Error('cause');

    logger('a-scope').error('it failed', e);

    expect(write).toHaveBeenCalledWith('[a-scope] it failed', e);
  });
});
