/**
 * Copyright (c) Hathor Labs and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * Simple counter-based flow ID generator for scoping Reown actions.
 * Flow IDs only need to be unique within the app session.
 *
 * This is used to prevent race conditions where multiple approval flows
 * (e.g., session proposals and dApp requests) could interfere with each other
 * when waiting on global REOWN_ACCEPT/REOWN_REJECT actions.
 */
let flowIdCounter = 0;

export const generateFlowId = () => {
  flowIdCounter += 1;
  return `flow_${flowIdCounter}`;
};
