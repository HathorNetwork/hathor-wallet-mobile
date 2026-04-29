/**
 * Test helper: renders a React component wrapped in all the providers
 * that the Hathor Wallet app expects (Redux, Navigation).
 *
 * Usage:
 *   const { getByText } = renderWithProviders(<MyScreen />, {
 *     preloadedState: { isOnline: true },
 *   });
 */
import React from 'react';
import { render, RenderOptions } from '@testing-library/react-native';
import { Provider } from 'react-redux';
import { NavigationContainer } from '@react-navigation/native';
import { createTestStore } from './mockStore';

interface ExtendedRenderOptions extends Omit<RenderOptions, 'wrapper'> {
  /** Partial Redux state merged on top of initialState. */
  preloadedState?: Record<string, unknown>;
  /** Supply your own store (e.g. if you need to dispatch in the test). */
  store?: ReturnType<typeof createTestStore>;
  /** If false, skip wrapping in NavigationContainer (default: true). */
  withNavigation?: boolean;
}

export function renderWithProviders(
  ui: React.ReactElement,
  {
    preloadedState = {},
    store = createTestStore(preloadedState),
    withNavigation = true,
    ...renderOptions
  }: ExtendedRenderOptions = {},
) {
  function Wrapper({ children }: { children: React.ReactNode }) {
    const content = <Provider store={store}>{children}</Provider>;
    if (withNavigation) {
      return <NavigationContainer>{content}</NavigationContainer>;
    }
    return content;
  }

  return {
    store,
    ...render(ui, { wrapper: Wrapper, ...renderOptions }),
  };
}
