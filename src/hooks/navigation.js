/**
 * Copyright (c) Hathor Labs and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import React, { createContext } from 'react';
import { useNavigation as useRNNavigation, useRoute } from '@react-navigation/native';
import { cloneDeep } from 'lodash';

/* global BigInt */

// This prefix helps identify serialized BigInt values
const BIG_INT_PREFIX = '__BIGINT__:';

// Recursive serialization/deserialization functions
function serialize(data) {
  if (data === null || data === undefined) return data;

  // Skip serialization for functions
  if (typeof data === 'function') return data;

  // Create a defensive copy of the data
  const clonedData = cloneDeep(data);

  if (typeof clonedData === 'bigint') {
    return `${BIG_INT_PREFIX}${clonedData.toString()}`;
  }

  if (Array.isArray(clonedData)) {
    return clonedData.map(serialize);
  }

  if (typeof clonedData === 'object') {
    return Object.fromEntries(serialize(Object.entries(clonedData)));
  }

  return clonedData;
}

function deserialize(data) {
  if (data === null || data === undefined) return data;

  // Skip deserialization for functions
  if (typeof data === 'function') return data;

  // Create a defensive copy of the data
  const clonedData = cloneDeep(data);

  if (typeof clonedData === 'string' && clonedData.startsWith(BIG_INT_PREFIX)) {
    return BigInt(clonedData.substring(BIG_INT_PREFIX.length));
  }

  if (Array.isArray(clonedData)) {
    return clonedData.map(deserialize);
  }

  if (typeof clonedData === 'object') {
    return Object.fromEntries(deserialize(Object.entries(clonedData)));
  }

  return clonedData;
}

// Custom navigation hook that handles BigInt automatically
export function useNavigation() {
  const navigation = useRNNavigation();

  // Return a proxy that intercepts navigation methods
  return new Proxy(navigation, {
    get(target, prop) {
      const value = target[prop];

      // If this is a navigation method, wrap it to handle BigInt
      if (prop === 'navigate' || prop === 'push' || prop === 'replace') {
        return (...args) => {
          // args[0]: routeName (string) - The name of the route to navigate to
          // args[1]: params (object) - Navigation parameters that may contain BigInt values
          if (args.length >= 2 && args[1]) {
            // Serialize any BigInt in the params
            const newArgs = [...args];
            newArgs[1] = serialize(args[1]);
            return value.apply(target, newArgs);
          }
          return value.apply(target, args);
        };
      }

      return value;
    }
  });
}

// Custom route params hook that handles BigInt automatically
export function useParams() {
  const route = useRoute();
  return route.params ? deserialize(route.params) : {};
}

// Context to be used by the NavigationSerializingProvider
const NavigationSerializingContext = createContext(null);

/**
 * Provider component that enables automatic BigInt serialization/deserialization
 * for React Navigation. Wrap your app's navigation structure with this component.
 */
export function NavigationSerializingProvider({ children }) {
  return (
    <NavigationSerializingContext.Provider value>
      {children}
    </NavigationSerializingContext.Provider>
  );
}
