/**
 * Test helper: mock navigation objects for React Navigation 7.
 *
 * Provides plain mock objects that can be passed as props or returned
 * from `useNavigation()`/`useRoute()` in a `jest.mock(...)` factory at
 * module scope in the consuming test file.
 *
 * Note: this file does NOT call `jest.mock(...)` itself. `jest.mock` is
 * hoisted by Babel only when written at top-level of the test module —
 * wrapping it inside an exported helper would defeat the hoist and run
 * after the modules under test are already imported.
 */
import { jest } from '@jest/globals';

export function createMockNavigation() {
  return {
    navigate: jest.fn(),
    push: jest.fn(),
    replace: jest.fn(),
    goBack: jest.fn(),
    reset: jest.fn(),
    setOptions: jest.fn(),
    setParams: jest.fn(),
    dispatch: jest.fn(),
    addListener: jest.fn(() => jest.fn()), // returns unsubscribe
    canGoBack: jest.fn(() => true),
    isFocused: jest.fn(() => true),
    getParent: jest.fn(),
    getState: jest.fn(() => ({
      index: 0,
      routes: [{ name: 'MockRoute', key: 'mock-key' }],
    })),
  };
}

export function createMockRoute(params: Record<string, unknown> = {}) {
  return {
    key: 'mock-route-key',
    name: 'MockRoute',
    params,
  };
}
