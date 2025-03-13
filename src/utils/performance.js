/**
 * Copyright (c) Hathor Labs and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { logger } from '../logger';

const log = logger('performance');

// Shared performance object to track timings across the application
const Performance = {
  timestamps: {},

  start: (label) => {
    Performance.timestamps[label] = Date.now();
    log.log(`🔍 PROFILING: [START] ${label}`);
  },

  end: (label) => {
    if (!Performance.timestamps[label]) {
      // Instead of throwing an error, just log a warning and continue
      log.log(`🔍 PROFILING: Note - ending measurement for ${label} that wasn't explicitly started. Creating timestamp now.`);
      // Create a timestamp for now, so we at least get a valid measurement (zero duration)
      Performance.timestamps[label] = Date.now();
    }

    const elapsed = Date.now() - Performance.timestamps[label];
    log.log(`🔍 PROFILING: [END] ${label} - ${elapsed}ms`);
    delete Performance.timestamps[label];
  }
};

export default Performance;
