/**
 * Copyright (c) Hathor Labs and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { useEffect, useRef } from 'react';
import { useDispatch } from 'react-redux';
import { reownUserReadyForNextFlow } from '../actions';

/**
 * Custom hook to manage the Reown ready signal for the unified queue.
 *
 * This hook provides a function to signal that the user is ready for the next
 * Reown flow, and automatically dispatches the signal on component unmount
 * if it hasn't been sent yet (belt-and-suspenders safety).
 *
 * @returns {Object} Object containing the signalReadyForNextFlow function
 */
export const useReownSignal = () => {
  const dispatch = useDispatch();
  const signalSentRef = useRef(false);

  // Helper to signal readiness and prevent duplicate dispatches
  const signalReadyForNextFlow = () => {
    signalSentRef.current = true;
    dispatch(reownUserReadyForNextFlow());
  };

  // Belt-and-suspenders: ensure signal is dispatched on unmount
  // in case of unexpected navigation or component unmount
  useEffect(() => () => {
    if (!signalSentRef.current) {
      dispatch(reownUserReadyForNextFlow());
    }
  }, [dispatch]);

  return { signalReadyForNextFlow };
};
