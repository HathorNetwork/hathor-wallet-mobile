import { put, call } from 'redux-saga/effects';
import { jest, test, expect, beforeEach, describe } from '@jest/globals';
import {
  checkForPendingRequests,
  fetchPendingRequests,
  rejectSinglePendingRequest,
  rejectAllPendingRequests,
} from '../../src/sagas/reown';
import {
  setReownPendingRequests,
  reownReject,
  reownRejectPendingRequest,
} from '../../src/actions';

const mockWalletKit = {
  getPendingSessionProposals: jest.fn(),
  getPendingSessionRequests: jest.fn(),
  getActiveSessions: jest.fn(),
  respondSessionRequest: jest.fn(),
};

const mockReownClient = {
  walletKit: mockWalletKit,
  core: {},
};

const makePendingRequest = (id, topic = 'topic1', method = 'htr_getBalance') => ({
  id,
  topic,
  params: {
    request: {
      method,
      params: {},
    },
  },
});

const makeActiveSession = (topic, name = 'Test dApp') => ({
  [topic]: {
    peer: {
      metadata: {
        name,
        icons: ['https://example.com/icon.png'],
        url: 'https://example.com',
        description: 'A test dApp',
      },
    },
  },
});

beforeEach(() => {
  jest.clearAllMocks();
});

describe('sagas/reown/checkForPendingRequests', () => {
  test('stores enriched pending requests in Redux', () => {
    const pending = [
      makePendingRequest(1, 'topic1', 'htr_getBalance'),
      makePendingRequest(2, 'topic1', 'htr_getAddress'),
    ];
    const sessions = makeActiveSession('topic1', 'Hathor dApp');

    const gen = checkForPendingRequests();

    // call getReownClient
    gen.next();
    // feed reownClient
    gen.next(mockReownClient);
    // call getPendingSessionProposals
    gen.next();
    // call getPendingSessionRequests — feed pending requests
    gen.next(pending);
    // call getActiveSessions — feed sessions
    const result = gen.next(sessions);

    // Assert it dispatches setReownPendingRequests with enriched data
    expect(result.value).toStrictEqual(put(setReownPendingRequests([
      {
        id: 1,
        topic: 'topic1',
        method: 'htr_getBalance',
        params: {},
        dapp: {
          name: 'Hathor dApp',
          icon: 'https://example.com/icon.png',
          url: 'https://example.com',
          description: 'A test dApp',
        },
      },
      {
        id: 2,
        topic: 'topic1',
        method: 'htr_getAddress',
        params: {},
        dapp: {
          name: 'Hathor dApp',
          icon: 'https://example.com/icon.png',
          url: 'https://example.com',
          description: 'A test dApp',
        },
      },
    ])));

    // Assert termination
    expect(gen.next().done).toBe(true);
  });

  test('does nothing when reown client is not initialized', () => {
    const gen = checkForPendingRequests();

    // call getReownClient
    gen.next();
    // feed null (not initialized)
    const result = gen.next(null);

    // Should return early
    expect(result.done).toBe(true);
  });

  test('handles empty pending requests', () => {
    const sessions = makeActiveSession('topic1');

    const gen = checkForPendingRequests();

    gen.next();
    gen.next(mockReownClient);
    gen.next();
    gen.next([]); // empty pending
    const result = gen.next(sessions);

    expect(result.value).toStrictEqual(put(setReownPendingRequests([])));
  });
});

describe('sagas/reown/fetchPendingRequests', () => {
  test('delegates to checkForPendingRequests', () => {
    const gen = fetchPendingRequests();
    const result = gen.next();

    expect(result.value).toStrictEqual(call(checkForPendingRequests));
    expect(gen.next().done).toBe(true);
  });
});

describe('sagas/reown/rejectSinglePendingRequest', () => {
  test('rejects request and refreshes list', () => {
    const action = reownRejectPendingRequest(42, 'topic1');
    const gen = rejectSinglePendingRequest(action);

    // call getReownClient
    gen.next();
    // feed reownClient
    gen.next(mockReownClient);
    // call respondSessionRequest (wrapped in lambda, so we check the call effect)
    const respondCall = gen.next();
    expect(respondCall.value.type).toBe('CALL');

    // After respond, call checkForPendingRequests
    const refreshCall = gen.next();
    expect(refreshCall.value).toStrictEqual(call(checkForPendingRequests));

    // Assert termination
    expect(gen.next().done).toBe(true);
  });

  test('does nothing when reown client is not initialized', () => {
    const action = reownRejectPendingRequest(42, 'topic1');
    const gen = rejectSinglePendingRequest(action);

    gen.next();
    const result = gen.next(null);

    expect(result.done).toBe(true);
  });
});

describe('sagas/reown/rejectAllPendingRequests', () => {
  test('rejects all pending requests, dispatches reownReject, and clears list', () => {
    const pending = [
      makePendingRequest(1, 'topic1'),
      makePendingRequest(2, 'topic1'),
      makePendingRequest(3, 'topic2'),
    ];

    const gen = rejectAllPendingRequests();

    // call getReownClient
    gen.next();
    // feed reownClient
    gen.next(mockReownClient);
    // call getPendingSessionRequests
    gen.next(pending);

    // Should call respondSessionRequest for each pending request
    // (3 calls, each wrapped in a lambda)
    gen.next(); // respond to request 1
    gen.next(); // respond to request 2
    gen.next(); // respond to request 3

    // Should dispatch reownReject to unblock the saga queue
    const rejectResult = gen.next();
    expect(rejectResult.value).toStrictEqual(put(reownReject()));

    // Should dispatch setReownPendingRequests([]) to clear the list
    const clearResult = gen.next();
    expect(clearResult.value).toStrictEqual(put(setReownPendingRequests([])));

    // Assert termination
    expect(gen.next().done).toBe(true);
  });

  test('does nothing when reown client is not initialized', () => {
    const gen = rejectAllPendingRequests();

    gen.next();
    const result = gen.next(null);

    expect(result.done).toBe(true);
  });

  test('handles empty pending requests gracefully', () => {
    const gen = rejectAllPendingRequests();

    gen.next();
    gen.next(mockReownClient);
    gen.next([]); // no pending requests

    // Should still dispatch reownReject and clear
    const rejectResult = gen.next();
    expect(rejectResult.value).toStrictEqual(put(reownReject()));

    const clearResult = gen.next();
    expect(clearResult.value).toStrictEqual(put(setReownPendingRequests([])));

    expect(gen.next().done).toBe(true);
  });
});
