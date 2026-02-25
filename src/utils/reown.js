/**
 * Copyright (c) Hathor Labs and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * Reown utility functions.
 *
 * Note: The generateFlowId function was removed as part of the unified queue implementation.
 * With a single actionChannel processing all user-facing Reown flows sequentially,
 * flowId scoping is no longer needed - only one modal can be active at a time.
 */
