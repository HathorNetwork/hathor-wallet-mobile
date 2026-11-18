/**
 * Copyright (c) Hathor Labs and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * The order to run a setup's scenarios on one wallet, whose balances carry from one scenario to
 * the next. The wallet starts with the minted tokens and no HTR, so zero-HTR scenarios go first,
 * before any top-up. Then failures, which spend nothing, go before successful sends, which do:
 * the public send of all 2^40 units of the large token would leave too little for the private
 * over-limit check.
 */
function runOrder(plan) {
  const rank = ({ scenario, outcome }) => {
    if (scenario.values.funding === 'zero-htr') return 0;
    return outcome.kind === 'success' ? 2 : 1;
  };
  // Array.prototype.sort is stable, so the graph's order holds within a rank.
  return [...plan].sort((a, b) => rank(a) - rank(b));
}

module.exports = { runOrder };
