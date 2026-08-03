/**
 * Test helper: creates a Redux store with optional preloaded state.
 *
 * Uses the real reducer from the app so that dispatched actions
 * produce the same state transitions as production code.
 */
import { legacy_createStore as createStore } from 'redux';
import { reducer } from '../../src/reducers/reducer';

/**
 * Create a Redux store for testing with optional state overrides.
 *
 * @param preloadedState - Partial state merged on top of the reducer's
 *   built-in initialState. Pass only the keys you care about.
 */
export function createTestStore(preloadedState: Record<string, unknown> = {}) {
  // Dispatching an unknown action returns initialState from the reducer,
  // which we then merge with the caller's overrides.
  const baseState = reducer(undefined, { type: '@@INIT' });
  return createStore(reducer, { ...baseState, ...preloadedState } as any);
}
