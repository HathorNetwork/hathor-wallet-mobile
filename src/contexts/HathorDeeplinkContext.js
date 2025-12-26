/**
 * Copyright (c) Hathor Labs and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  useRef,
  useMemo,
} from 'react';
import { Linking } from 'react-native';
import { useSelector, useDispatch } from 'react-redux';
import { WALLET_STATUS } from '../sagas/wallet';
import { DEEP_LINK_SCHEME, DEEP_LINK_TYPE } from '../constants';
import { reownUriInputted } from '../actions';
import NavigationService from '../NavigationService';

/**
 * @typedef {Object} DeepLinkAction
 * @property {string} type - The type of deep link (navigate or walletconnect)
 * @property {string} [screen] - The screen to navigate to (for navigate type)
 * @property {Object} [params] - Navigation params (for navigate type)
 * @property {string} [uri] - WalletConnect URI (for walletconnect type)
 */

/**
 * @typedef {Object} HathorDeeplinkContextValue
 * @property {DeepLinkAction|null} pendingDeepLink - Deep link waiting to be processed
 * @property {boolean} isProcessing - Whether a deep link is being processed
 * @property {string|null} error - Error message if processing failed
 * @property {function} clearPendingDeepLink - Clear the pending deep link
 */

const HathorDeeplinkContext = createContext(undefined);

/**
 * Checks if a WalletConnect URI is a pairing URI (for new connections)
 * vs a session URI (for existing session requests).
 * Pairing URIs contain symKey parameter, session URIs don't.
 * @param {string} uri - The WalletConnect URI
 * @returns {boolean} True if this is a pairing URI
 */
export const isPairingUri = (uri) => uri && uri.includes('symKey=');

/**
 * Parses a deep link URL and returns the appropriate action.
 * @param {string} url - The deep link URL (e.g., hathorwallet://reown?uri=wc:...)
 * @returns {DeepLinkAction|null} Deep link action or null if URL is invalid
 */
const parseDeepLink = (url) => {
  const schemePrefix = `${DEEP_LINK_SCHEME}://`;

  if (!url || !url.startsWith(schemePrefix)) {
    return null;
  }

  try {
    const path = url.replace(schemePrefix, '');
    const [route, queryString] = path.split('?');

    // Parse query parameters
    const params = {};
    if (queryString) {
      queryString.split('&').forEach((param) => {
        const [key, value] = param.split('=');
        if (key && value) {
          params[key] = decodeURIComponent(value);
        }
      });
    }

    switch (route) {
      case 'dashboard':
        return { type: DEEP_LINK_TYPE.NAVIGATE, screen: 'Main', params: { screen: 'Home' } };
      case 'reown':
        return { type: DEEP_LINK_TYPE.NAVIGATE, screen: 'ReownManual', params };
      case 'wc':
        // WalletConnect mobile linking - extract the WC URI from query params
        // Format: hathorwallet://wc?uri=wc:sessionId@2?relay-protocol=irn&symKey=...
        if (params.uri) {
          return { type: DEEP_LINK_TYPE.WALLETCONNECT, uri: params.uri };
        }
        return null;
      default:
        return null;
    }
  } catch (e) {
    console.error('Error parsing deep link:', e);
    return null;
  }
};

/**
 * Processes a deep link action by dispatching the appropriate action and navigating if needed.
 * @param {DeepLinkAction} deepLinkAction - The parsed deep link action
 * @param {function} dispatchWalletConnectUri - Function to dispatch WalletConnect URI
 */
const processDeepLinkAction = (deepLinkAction, dispatchWalletConnectUri) => {
  if (deepLinkAction.type === DEEP_LINK_TYPE.WALLETCONNECT) {
    dispatchWalletConnectUri(deepLinkAction.uri);
    // Only navigate to ReownList for new connection requests (pairing URIs have symKey param)
    // RPC requests on existing sessions don't need navigation - modal will appear automatically
    if (isPairingUri(deepLinkAction.uri)) {
      NavigationService.navigate('ReownList');
    }
  } else if (deepLinkAction.type === DEEP_LINK_TYPE.NAVIGATE) {
    NavigationService.navigate(deepLinkAction.screen, deepLinkAction.params);
  }
};

/**
 * Provider component that manages deep link state and processing.
 * Handles deep links when they arrive and queues them if the wallet isn't ready.
 */
export function HathorDeeplinkProvider({ children }) {
  const [pendingDeepLink, setPendingDeepLink] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState(null);

  // Track processed URLs to avoid re-processing
  const processedUrls = useRef(new Set());

  const dispatch = useDispatch();
  const walletStartState = useSelector((state) => state.walletStartState);
  const isScreenLocked = useSelector((state) => state.lockScreen);

  const isWalletReady = walletStartState === WALLET_STATUS.READY;
  const isUnlocked = !isScreenLocked;
  const canProcess = isWalletReady && isUnlocked;

  /**
   * Clear the pending deep link
   */
  const clearPendingDeepLink = useCallback(() => {
    setPendingDeepLink(null);
    setError(null);
  }, []);

  /**
   * Dispatch WalletConnect URI action
   */
  const dispatchWalletConnectUri = useCallback(
    (uri) => dispatch(reownUriInputted(uri)),
    [dispatch]
  );

  /**
   * Handle incoming deep link URL
   */
  const handleDeepLink = useCallback(
    (url) => {
      // Skip if already processed
      if (processedUrls.current.has(url)) {
        return;
      }

      setIsProcessing(true);
      setError(null);

      try {
        const deepLinkAction = parseDeepLink(url);

        if (!deepLinkAction) {
          setIsProcessing(false);
          return;
        }

        // Mark as processed
        processedUrls.current.add(url);

        // Clear old URLs to prevent memory leak (keep last 10)
        if (processedUrls.current.size > 10) {
          const urls = Array.from(processedUrls.current);
          processedUrls.current = new Set(urls.slice(-10));
        }

        if (canProcess) {
          // Wallet is ready, process immediately
          processDeepLinkAction(deepLinkAction, dispatchWalletConnectUri);
        } else {
          // Store for later processing
          setPendingDeepLink(deepLinkAction);
        }
      } catch (e) {
        console.error('Error handling deep link:', e);
        setError(e.message || 'Failed to process deep link');
      } finally {
        setIsProcessing(false);
      }
    },
    [canProcess, dispatchWalletConnectUri]
  );

  // Process pending deep link when wallet becomes ready
  useEffect(() => {
    if (canProcess && pendingDeepLink) {
      processDeepLinkAction(pendingDeepLink, dispatchWalletConnectUri);
      setPendingDeepLink(null);
    }
  }, [canProcess, pendingDeepLink, dispatchWalletConnectUri]);

  // Handle initial URL (app opened from deep link)
  useEffect(() => {
    Linking.getInitialURL()
      .then((url) => {
        if (url) {
          handleDeepLink(url);
        }
      })
      .catch((e) => {
        console.error('Error getting initial URL:', e);
      });
  }, [handleDeepLink]);

  // Listen for deep links while app is running
  useEffect(() => {
    const subscription = Linking.addEventListener('url', ({ url }) => {
      handleDeepLink(url);
    });

    return () => subscription.remove();
  }, [handleDeepLink]);

  const value = useMemo(() => ({
    pendingDeepLink,
    isProcessing,
    error,
    clearPendingDeepLink,
  }), [pendingDeepLink, isProcessing, error, clearPendingDeepLink]);

  return (
    <HathorDeeplinkContext.Provider value={value}>
      {children}
    </HathorDeeplinkContext.Provider>
  );
}

/**
 * Hook to access the deep link context
 * @returns {HathorDeeplinkContextValue}
 */
export function useHathorDeeplink() {
  const context = useContext(HathorDeeplinkContext);

  if (context === undefined) {
    throw new Error('useHathorDeeplink must be used within a HathorDeeplinkProvider');
  }

  return context;
}

/**
 * Hook to handle a specific deep link action type
 * @param {string} actionType - The action type to listen for (from DEEP_LINK_TYPE)
 * @param {function} callback - Callback to execute when this action type is received
 */
export function useDeepLinkAction(actionType, callback) {
  const { pendingDeepLink, clearPendingDeepLink } = useHathorDeeplink();

  useEffect(() => {
    if (pendingDeepLink && pendingDeepLink.type === actionType) {
      callback(pendingDeepLink);
      clearPendingDeepLink();
    }
  }, [pendingDeepLink, actionType, callback, clearPendingDeepLink]);
}
