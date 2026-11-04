/**
 * @jest-environment node
 *
 * Copyright (c) Hathor Labs and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { describe, expect, it } from '@jest/globals';
import { runOrder } from '../../QA/e2e/lib/runOrder';

const entry = (id, funding, kind) => ({ scenario: { id, values: { funding } }, outcome: { kind } });

describe('run order', () => {
  it('runs zero-HTR scenarios first, then failures, then successful sends', () => {
    const plan = [
      entry('sent', 'enough-htr', 'success'),
      entry('error', 'enough-htr', 'error'),
      entry('zero', 'zero-htr', 'error'),
    ];
    expect(runOrder(plan).map((p) => p.scenario.id)).toEqual(['zero', 'error', 'sent']);
  });

  it('keeps the graph order within a group, and leaves the plan as it was', () => {
    const plan = [entry('a', 'enough-htr', 'error'), entry('b', 'enough-htr', 'error')];
    expect(runOrder(plan).map((p) => p.scenario.id)).toEqual(['a', 'b']);
    expect(plan.map((p) => p.scenario.id)).toEqual(['a', 'b']);
  });
});
