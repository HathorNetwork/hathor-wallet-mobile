/**
 * Copyright (c) Hathor Labs and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import React, { createContext, useContext, useState, useCallback, useMemo } from 'react';
import { View, StyleSheet } from 'react-native';

/**
 * Portal system for rendering components at root level.
 *
 * This allows modals and overlays to escape their parent container's
 * positioning context and render at the app root level, avoiding z-index
 * and clipping issues.
 */

const PortalContext = createContext(null);

let portalId = 0;

export const PortalProvider = ({ children }) => {
  const [portals, setPortals] = useState({});

  const addPortal = useCallback((id, node) => {
    setPortals((prev) => ({ ...prev, [id]: node }));
  }, []);

  const removePortal = useCallback((id) => {
    setPortals((prev) => {
      const newPortals = { ...prev };
      delete newPortals[id];
      return newPortals;
    });
  }, []);

  const contextValue = useMemo(() => ({ addPortal, removePortal }), [addPortal, removePortal]);

  return (
    <PortalContext.Provider value={contextValue}>
      {children}
      <PortalHost portals={portals} />
    </PortalContext.Provider>
  );
};

/**
 * Portal Host - renders all portal content at root level
 */
const PortalHost = ({ portals }) => {
  const portalNodes = Object.values(portals);

  if (portalNodes.length === 0) {
    return null;
  }

  return (
    <View style={styles.portalHost} pointerEvents='box-none'>
      {portalNodes}
    </View>
  );
};

/**
 * Portal - wrap components to render them at root level
 */
export const Portal = ({ children }) => {
  const context = useContext(PortalContext);
  const [id] = useState(() => {
    const currentId = portalId;
    portalId += 1;
    return `portal-${currentId}`;
  });

  React.useEffect(() => {
    if (!context) {
      console.error('Portal must be used within PortalProvider');
      return undefined;
    }

    context.addPortal(id, children);

    return () => {
      context.removePortal(id);
    };
  }, [id, children, context]);

  // Portal renders nothing in place - content appears at PortalHost
  return null;
};

const styles = StyleSheet.create({
  portalHost: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 9999,
    elevation: 9999,
  },
});
