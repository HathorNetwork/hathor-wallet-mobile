/**
 * Copyright (c) Hathor Labs and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { useEffect, useRef } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigation } from '@react-navigation/native';
import { reownUserReadyForNextFlow, setForceNavigateToDashboard } from '../actions';

/**
 * Custom hook to manage the Reown ready signal for the unified queue.
 *
 * This hook provides a function to signal that the user is ready for the next
 * Reown flow, and automatically dispatches the signal on component unmount
 * if it hasn't been sent yet (belt-and-suspenders safety).
 *
 * It also handles force navigation to Dashboard when timeout occurs,
 * using `replace` to remove the Reown screen from the navigation stack.
 *
 * @returns {Object} Object containing the signalReadyForNextFlow function
 */
export const useReownSignal = () => {
  const dispatch = useDispatch();
  const navigation = useNavigation();
  const signalSentRef = useRef(false);
  const forceNavigateToDashboard = useSelector(
    (state) => state.reown.forceNavigateToDashboard
  );

  // Helper to signal readiness and prevent duplicate dispatches
  const signalReadyForNextFlow = () => {
    signalSentRef.current = true;
    dispatch(reownUserReadyForNextFlow());
  };

  // Handle force navigation to Dashboard (e.g., on timeout)
  // Uses replace to remove Reown screen from stack, so Back won't return to it
  useEffect(() => {
    if (forceNavigateToDashboard) {
      dispatch(setForceNavigateToDashboard(false));
      navigation.replace('Main');
    }
  }, [forceNavigateToDashboard, dispatch, navigation]);

  // Belt-and-suspenders: ensure signal is dispatched on unmount
  // in case of unexpected navigation or component unmount
  useEffect(() => () => {
    if (!signalSentRef.current) {
      dispatch(reownUserReadyForNextFlow());
    }
  }, [dispatch]);

  return { signalReadyForNextFlow };
};
