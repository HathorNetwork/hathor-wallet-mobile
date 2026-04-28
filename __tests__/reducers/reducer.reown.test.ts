/**
 * Unit tests for the Reown pending-requests reducer slice.
 *
 * Covers the slice introduced on this branch:
 *   - state.reown.pendingRequests
 *   - REOWN_SET_PENDING_REQUESTS action
 *
 * Acts as a safety net for the future RTK-slices refactor by pinning:
 *   - Behavior (action -> state)
 *   - Initial state shape of state.reown
 *   - Action-type literal string
 */
import { describe, it, expect } from '@jest/globals';
import { reducer } from '../../src/reducers/reducer';
import { setReownPendingRequests, types } from '../../src/actions';

const getInitialState = () => reducer(undefined, { type: '@@INIT' });

// ─── Behavior ──────────────────────────────────────────────────────────────
describe('REOWN_SET_PENDING_REQUESTS', () => {
  it('initial state.reown.pendingRequests is an empty array', () => {
    expect(getInitialState().reown.pendingRequests).toEqual([]);
  });

  it('replaces pendingRequests with the payload (does not append)', () => {
    let state = reducer(getInitialState(), setReownPendingRequests([{ id: 'a' }]));
    expect(state.reown.pendingRequests).toEqual([{ id: 'a' }]);

    state = reducer(state, setReownPendingRequests([{ id: 'b' }, { id: 'c' }]));
    expect(state.reown.pendingRequests).toEqual([{ id: 'b' }, { id: 'c' }]);
  });

  it('accepts an empty array (clears pending)', () => {
    let state = reducer(getInitialState(), setReownPendingRequests([{ id: 'a' }]));
    state = reducer(state, setReownPendingRequests([]));
    expect(state.reown.pendingRequests).toEqual([]);
  });

  it('does not mutate other reown sub-keys', () => {
    const initial = getInitialState();
    const next = reducer(initial, setReownPendingRequests([{ id: 'a' }]));
    expect(next.reown.sessions).toBe(initial.reown.sessions);
    expect(next.reown.connectionFailed).toBe(initial.reown.connectionFailed);
    expect(next.reown.modal).toBe(initial.reown.modal);
    expect(next.reown.client).toBe(initial.reown.client);
    expect(next.reown.error).toBe(initial.reown.error);
  });

  it('returns a new state reference (no in-place mutation)', () => {
    const initial = getInitialState();
    const next = reducer(initial, setReownPendingRequests([{ id: 'a' }]));
    expect(next).not.toBe(initial);
    expect(next.reown).not.toBe(initial.reown);
  });
});

// ─── Initial-State Shape Contract ──────────────────────────────────────────
// Pins the keys of state.reown. A future RTK-slices refactor must preserve
// this shape OR consciously update this snapshot.
describe('initial state.reown shape contract', () => {
  it('exposes the expected reown keys', () => {
    const reownKeys = Object.keys(getInitialState().reown).sort();
    expect(reownKeys).toEqual([
      'client',
      'connectionFailed',
      'createNanoContractCreateTokenTx',
      'createToken',
      'error',
      'forceNavigateToDashboard',
      'modal',
      'newNanoContractTransaction',
      'pendingRequests',
      'sendTransaction',
      'sessions',
    ]);
  });
});

// ─── Action-Type Contract ──────────────────────────────────────────────────
// Pins the literal `.type` strings; catches RTK auto-renaming.
describe('action-type contract', () => {
  it('setReownPendingRequests.type', () => {
    expect(setReownPendingRequests([]).type).toBe('REOWN_SET_PENDING_REQUESTS');
  });

  it('types.REOWN_SET_PENDING_REQUESTS literal string', () => {
    expect(types.REOWN_SET_PENDING_REQUESTS).toBe('REOWN_SET_PENDING_REQUESTS');
  });
});
