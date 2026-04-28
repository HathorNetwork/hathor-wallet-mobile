/**
 * Test helper: mock navigation objects for React Navigation 7.
 *
 * Provides mock implementations of useNavigation and useRoute that
 * components can call without a real NavigationContainer.
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

/**
 * Setup jest mocks for both React Navigation's native hooks
 * and the app's custom BigInt-aware hooks in src/hooks/navigation.js.
 *
 * Call this in a beforeEach or at module scope in your test file.
 *
 * @returns Object with references to the mocks for assertion.
 */
export function setupNavigationMocks(routeParams: Record<string, unknown> = {}) {
  const mockNav = createMockNavigation();
  const mockRoute = createMockRoute(routeParams);

  // Mock React Navigation's native hooks
  jest.mock('@react-navigation/native', () => {
    const actual = jest.requireActual('@react-navigation/native') as any;
    return {
      ...actual,
      useNavigation: () => mockNav,
      useRoute: () => mockRoute,
    };
  });

  // Mock the app's custom hooks (which wrap the above with BigInt handling)
  jest.mock('../../src/hooks/navigation', () => ({
    useNavigation: () => mockNav,
    useParams: () => mockRoute.params,
  }));

  return { navigation: mockNav, route: mockRoute };
}
