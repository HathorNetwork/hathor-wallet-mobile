/**
 * Copyright (c) Hathor Labs and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import React, { createContext } from 'react';
import { useNavigation as useRNNavigation, useRoute } from '@react-navigation/native';

/* global BigInt */

// This prefix helps identify serialized BigInt values
const BIG_INT_PREFIX = '__BIGINT__:';

// Recursive serialization/deserialization functions
function serialize(data) {
  if (data === null || data === undefined) return data;

  if (typeof data === 'bigint') {
    return `${BIG_INT_PREFIX}${data.toString()}`;
  }

  if (Array.isArray(data)) {
    return data.map(serialize);
  }

  if (typeof data === 'object') {
    const result = {};
    Object.keys(data).forEach((key) => {
      result[key] = serialize(data[key]);
    });
    return result;
  }

  return data;
}

function deserialize(data) {
  if (data === null || data === undefined) return data;

  if (typeof data === 'string' && data.startsWith(BIG_INT_PREFIX)) {
    return BigInt(data.substring(BIG_INT_PREFIX.length));
  }

  if (Array.isArray(data)) {
    return data.map(deserialize);
  }

  if (typeof data === 'object') {
    const result = {};
    Object.keys(data).forEach((key) => {
      result[key] = deserialize(data[key]);
    });
    return result;
  }

  return data;
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
