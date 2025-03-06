/**
 * Copyright (c) Hathor Labs and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { useState, useEffect } from 'react';
import { BackHandler } from 'react-native';
import { useNavigation } from '@react-navigation/native';

/**
 * Custom hook to handle back button and navigation events with a confirmation modal
 *
 * @param {Function} showConfirmationModal - Function to show the confirmation modal
 * @param {boolean} allowNavigationCondition - Condition to allow navigation without confirmation
 * @returns {Object} - Object containing state and functions to manage back navigation
 */
export const useBackButtonHandler = (showConfirmationModal, allowNavigationCondition = false) => {
  const navigation = useNavigation();
  const [isIntentionallyNavigatingBack, setIsIntentionallyNavigatingBack] = useState(false);

  // Set up back button and navigation event handlers
  useEffect(() => {
    // Add back button handler to intercept Android back button
    const backHandler = BackHandler.addEventListener('hardwareBackPress', () => {
      // If we're intentionally navigating back or the condition to allow navigation is met,
      // allow the default back behavior
      if (isIntentionallyNavigatingBack || allowNavigationCondition) {
        return false;
      }
      // Show confirmation modal instead of going back directly
      showConfirmationModal();
      // Return true to prevent default back behavior
      return true;
    });

    // Add navigation event listener to handle iOS swipe back gesture
    const beforeRemoveListener = navigation.addListener('beforeRemove', (e) => {
      // If we're intentionally navigating back or the condition to allow navigation is met,
      // allow navigation
      if (isIntentionallyNavigatingBack || allowNavigationCondition) {
        return;
      }
      // Prevent default navigation behavior
      e.preventDefault();
      // Show confirmation modal instead
      showConfirmationModal();
    });

    // Cleanup function to remove event listeners
    return () => {
      backHandler.remove();
      beforeRemoveListener();
    };
  }, [
    isIntentionallyNavigatingBack,
    allowNavigationCondition,
    navigation,
    showConfirmationModal
  ]);

  /**
   * Function to safely navigate back after confirmation
   * @param {Function} beforeNavigateCallback - Optional callback to execute before navigation
   */
  const navigateBack = (beforeNavigateCallback) => {
    setIsIntentionallyNavigatingBack(true);

    // Execute callback if provided
    if (beforeNavigateCallback) {
      beforeNavigateCallback();
    }

    // We need to give time for any modal to close
    // before navigating back
    setTimeout(() => {
      navigation.goBack();
    }, 0);
  };

  /**
   * Function to safely navigate to a specific screen after confirmation
   * @param {string} screenName - Name of the screen to navigate to
   * @param {Object} params - Optional parameters to pass to the screen
   * @param {Function} beforeNavigateCallback - Optional callback to execute before navigation
   */
  const navigateTo = (screenName, params = {}, beforeNavigateCallback) => {
    setIsIntentionallyNavigatingBack(true);

    // Execute callback if provided
    if (beforeNavigateCallback) {
      beforeNavigateCallback();
    }

    // We need to give time for any modal to close
    // before navigating
    setTimeout(() => {
      navigation.navigate(screenName, params);
    }, 0);
  };

  return {
    isIntentionallyNavigatingBack,
    setIsIntentionallyNavigatingBack,
    navigateBack,
    navigateTo
  };
};
