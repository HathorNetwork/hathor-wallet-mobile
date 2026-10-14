import { jest, describe, test, expect, afterEach } from '@jest/globals';

// reown.js imports these native/ESM-only packages at module load; this test never touches them.
// (Stubbing them is also what lets this suite load at all: the untranspiled ESM in
// @walletconnect/react-native-compat is why __tests__/sagas/reown.test.js currently can't run.)
jest.mock('@walletconnect/react-native-compat', () => ({}));
jest.mock('@walletconnect/core', () => ({ Core: jest.fn() }));
jest.mock('@reown/walletkit', () => ({ WalletKit: { init: jest.fn() } }));
jest.mock('@hathor/hathor-rpc-handler', () => ({
  ...jest.requireActual('@hathor/hathor-rpc-handler'),
  handleRpcRequest: jest.fn(),
}));

/* eslint-disable import/first */
import { runSaga } from 'redux-saga';
import {
  handleRpcRequest,
  CreateTokenError,
  SendTransactionError,
  RpcResponseTypes,
} from '@hathor/hathor-rpc-handler';
import { processRequest } from '../../src/sagas/reown';
/* eslint-enable import/first */

const TOPIC = 'topic-1';
const REQUEST_ID = 42;

const walletKit = {
  getPendingSessionRequests: jest.fn(() => [{ id: REQUEST_ID }]),
  getActiveSessions: jest.fn(() => ({
    [TOPIC]: { peer: { metadata: { name: 'dapp' } }, namespaces: {} },
  })),
  respondSessionRequest: jest.fn(async () => {}),
};

// Stub only the client/network helpers, by name. Everything else runs for real — in particular the
// `fork(pollPendingRequests)` this test is about, an infinite loop that only stops when cancelled.
const stubs = {
  getReownClient: () => ({ walletKit }),
  checkForPendingRequests: () => undefined,
  retryHandler: () => true, // the user taps "Try again"
};
const stubMiddleware = (next) => (effect) => {
  const name = effect?.type === 'CALL' ? effect.payload.fn?.name : undefined;
  if (name && stubs[name]) {
    return next(stubs[name]());
  }
  return next(effect);
};

// Mirrors redux-thunk: processRequest grabs `dispatch` by putting a function.
const dispatch = (action) => (typeof action === 'function' ? action(dispatch) : action);

const action = {
  payload: { id: REQUEST_ID, topic: TOPIC, params: { request: { method: 'htr_test' } } },
};

let task;

afterEach(() => {
  if (task?.isRunning()) task.cancel();
  jest.clearAllMocks();
});

describe('processRequest retry branches', () => {
  // A retry recurses with `yield* processRequest(action)`, which runs inside the SAME task and
  // returns early, skipping the cancel at the end of the attempt. If the attempt's poll fork isn't
  // cancelled first, it stays attached to the task forever, so the saga that `call`ed
  // processRequest (unifiedReownFlowListener) never resumes and every later dapp request is stuck.
  //
  // Not covered here: the CreateNanoContractCreateTokenTxError branch (hathor-rpc-handler 5.0.0
  // doesn't export that class — those failures arrive as SendNanoContractTxError, whose branch
  // already cancels) and the PIN-cancel retry (driven by a module-private flag).
  test.each([
    ['CreateTokenError', CreateTokenError, RpcResponseTypes.CreateTokenResponse],
    ['SendTransactionError', SendTransactionError, RpcResponseTypes.SendTransactionResponse],
  ])('completes after a %s retry (no leaked poll fork)', async (_name, ErrorClass, responseType) => {
    handleRpcRequest
      .mockRejectedValueOnce(new ErrorClass('first attempt failed'))
      .mockResolvedValueOnce({ type: responseType });

    task = runSaga(
      { dispatch, getState: () => ({ wallet: {} }), effectMiddlewares: [stubMiddleware] },
      processRequest,
      action,
    );

    const outcome = await Promise.race([
      task.toPromise().then(() => 'completed'),
      new Promise((resolve) => { setTimeout(() => resolve('hung'), 1000); }),
    ]);

    expect(outcome).toBe('completed');
    // Both attempts ran, and the retry answered the dapp with the successful result.
    expect(handleRpcRequest).toHaveBeenCalledTimes(2);
    expect(walletKit.respondSessionRequest).toHaveBeenCalledWith(expect.objectContaining({
      response: expect.objectContaining({ result: { type: responseType } }),
    }));
  });
});
