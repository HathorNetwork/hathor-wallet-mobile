/**
 * Copyright (c) Hathor Labs and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * The numbers the simulated Hathor Next and the simulated transfer use, all in one place until the
 * real ones are known. Amounts are decimal strings in HTR; the code converts them to each chain's
 * units.
 */

/** The flat fee of a Hathor Next payment: the real value (0.05, Hathor Next's FEE_BASE). */
export const NEXT_SEND_FEE = '0.05';

/** The bridge's fee for a transfer from Hathor Network. */
export const BRIDGE_FEE = '0.10';

/** Hathor Network's fee for the transfer's transaction: an HTR transfer pays none. */
export const BRIDGE_NETWORK_FEE = '0.00';

/** The smallest transfer the bridge takes. */
export const BRIDGE_MIN_AMOUNT = '1.00';

/** How long a transfer takes to arrive on Hathor Next. */
export const BRIDGE_ETA_SECONDS = 120;

/** How long connecting to the simulated Hathor Next takes. */
export const CONNECT_DELAY_MS = 1200;

/** How long the first sync takes in the "Slow sync" scenario. */
export const SLOW_SYNC_MS = 20000;

/** When the connection drops in the "Goes offline" scenario, and for how long. */
export const OFFLINE_AFTER_MS = 30000;
export const OFFLINE_FOR_MS = 20000;

/** How long the network takes to answer a payment. */
export const SEND_DELAY_MS = 600;

/** How long the simulated transfer's broadcast takes on Hathor Network. */
export const TRANSFER_DELAY_MS = 800;
