/**
 * Copyright (c) Hathor Labs and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * @param {number} size
 * @example
 * getViewBox(24)
 * // return `0 0 24 24`
 */
export const getViewBox = (size) => `0 0 ${size} ${size}`;

/**
 * @param {number} size
 * @param {number} baseSize
 * @example
 * getScale(48, 24)
 * // return `scale(2)`
 */
export const getScale = (size, baseSize) => `scale(${size / baseSize})`;
