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
    // feed reownClient → yields call(respondSessionRequest) (wrapped in lambda)
    const respondCall = gen.next(mockReownClient);
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
  test('rejects all pending requests, dispatches reownReject, and resyncs list', () => {
    const pending = [
      makePendingRequest(1, 'topic1'),
      makePendingRequest(2, 'topic1'),
      makePendingRequest(3, 'topic2'),
    ];

    const gen = rejectAllPendingRequests();

    // call getReownClient
    gen.next();
    // feed reownClient → yields call(getPendingSessionRequests)
    gen.next(mockReownClient);
    // feed pending → yields call(respondSessionRequest #1)
    gen.next(pending);

    // Two more responds (#2 and #3) — gen.next(pending) already returned #1
    gen.next();
    gen.next();

    // Should dispatch reownReject to unblock the saga queue
    const rejectResult = gen.next();
    expect(rejectResult.value).toStrictEqual(put(reownReject()));

    // Should re-fetch pending list (a request may have arrived during rejection)
    const refetchResult = gen.next();
    expect(refetchResult.value.type).toBe('CALL');

    // Feed the re-fetch with [] → yields put(setReownPendingRequests([]))
    const clearResult = gen.next([]);
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
    // feed [] → for-loop is skipped, yields put(reownReject) directly
    const rejectResult = gen.next([]);
    expect(rejectResult.value).toStrictEqual(put(reownReject()));

    // Re-fetch yields call(getPendingSessionRequests)
    const refetchResult = gen.next();
    expect(refetchResult.value.type).toBe('CALL');

    // Feed [] for the re-fetch → yields put(setReownPendingRequests([]))
    const clearResult = gen.next([]);
    expect(clearResult.value).toStrictEqual(put(setReownPendingRequests([])));

    expect(gen.next().done).toBe(true);
  });
});
