import { jest, describe, test, expect, afterEach } from '@jest/globals';

// reown.js imports these native/ESM-only packages at module load; this test never touches them.
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
  RpcResponseTypes,
  TriggerTypes,
} from '@hathor/hathor-rpc-handler';
import { processRequest } from '../../src/sagas/reown';
import { ReownModalTypes } from '../../src/components/Reown/ReownModal';
import { types } from '../../src/actions';
/* eslint-enable import/first */

const TOPIC = 'topic-1';
const REQUEST_ID = 42;
const NC_ID = '000063f99b133c7630bc9d0117919f5b8726155412ad063dbbd618bdc7f85d7a';
const ORACLE = 'WewDeXWyvHP7jJTs7tjLoQfoB72LLxJQqN';

const walletKit = {
  getPendingSessionRequests: jest.fn(() => [{ id: REQUEST_ID }]),
  getActiveSessions: jest.fn(() => ({
    [TOPIC]: { peer: { metadata: { name: 'dapp' } }, namespaces: {} },
  })),
  respondSessionRequest: jest.fn(async () => {}),
};

// Stub only the client/network helpers, by name; the rest of processRequest runs for real.
const stubs = {
  getReownClient: () => ({ walletKit }),
  checkForPendingRequests: () => undefined,
};
const stubMiddleware = (next) => (effect) => {
  const name = effect?.type === 'CALL' ? effect.payload.fn?.name : undefined;
  if (name && stubs[name]) {
    return next(stubs[name]());
  }
  return next(effect);
};

let dispatched = [];
// Mirrors redux-thunk: processRequest grabs `dispatch` by putting a function.
const dispatch = (action) => {
  if (typeof action === 'function') {
    return action(dispatch);
  }
  dispatched.push(action);
  return action;
};

const oracleRequest = (params) => ({
  method: 'htr_signOracleData',
  params: {
    network: 'testnet', oracle: ORACLE, data: 'result', ...params,
  },
});

let task;

async function run(request) {
  task = runSaga(
    { dispatch, getState: () => ({ wallet: {} }), effectMiddlewares: [stubMiddleware] },
    processRequest,
    { payload: { id: REQUEST_ID, topic: TOPIC, params: { request } } },
  );
  await task.toPromise();
}

const answeredWith = () => walletKit.respondSessionRequest.mock.calls.map(([arg]) => arg.response);

afterEach(() => {
  if (task?.isRunning()) task.cancel();
  dispatched = [];
  jest.clearAllMocks();
});

describe('htr_signOracleData nc_id guard', () => {
  // A 30-byte nc_id plus a one-character data serialize to exactly 32 bytes: the shape that lets a
  // dApp make the oracle signature a transaction's input signature.
  test.each([
    ['a 30-byte nc_id', 'ab'.repeat(30)],
    ['no nc_id', undefined],
    ['an empty nc_id', ''],
    ['a number', 1234],
    // RegExp#test stringifies its argument, and a one-element array becomes its element.
    ['an array holding a valid ID', [NC_ID]],
    ['63 hex characters', NC_ID.slice(1)],
    ['65 hex characters', `${NC_ID}0`],
    ['a 0x prefix', `0x${NC_ID.slice(2)}`],
    ['a non-hex character', `${NC_ID.slice(0, 63)}g`],
    ['a non-hex character early on', `${NC_ID.slice(0, 2)}zz${NC_ID.slice(4)}`],
    ['surrounding whitespace', ` ${NC_ID}`],
  ])('refuses %s before the rpc handler, with 5003 and the error modal', async (_label, ncId) => {
    await run(oracleRequest({ nc_id: ncId, data: '/' }));

    expect(handleRpcRequest).not.toHaveBeenCalled();
    expect(answeredWith()).toEqual([{
      id: REQUEST_ID,
      jsonrpc: '2.0',
      error: {
        code: 5003,
        message: 'htr_signOracleData requires nc_id to be a nano contract ID: 64 hex characters.',
      },
    }]);
    expect(dispatched).toContainEqual(expect.objectContaining({
      type: types.SET_REOWN_MODAL,
      payload: expect.objectContaining({ show: true, type: ReownModalTypes.REQUEST_ERROR }),
    }));
    expect(dispatched).toContainEqual(expect.objectContaining({
      type: types.REOWN_SET_ERROR,
      payload: expect.objectContaining({ type: 'InvalidOracleNanoContractIdError' }),
    }));
  });

  test.each([
    ['lowercase', NC_ID],
    ['uppercase', NC_ID.toUpperCase()],
  ])('passes a %s 64-hex nc_id to the rpc handler', async (_label, ncId) => {
    handleRpcRequest.mockResolvedValueOnce({ type: RpcResponseTypes.SignOracleDataResponse });

    await run(oracleRequest({ nc_id: ncId }));

    expect(handleRpcRequest).toHaveBeenCalledTimes(1);
    expect(handleRpcRequest.mock.calls[0][0].params.nc_id).toBe(ncId);
    expect(answeredWith()).toEqual([expect.objectContaining({
      result: { type: RpcResponseTypes.SignOracleDataResponse },
    })]);
  });

  test('leaves other methods alone', async () => {
    handleRpcRequest.mockResolvedValueOnce({ type: RpcResponseTypes.SendNanoContractTxResponse });

    await run({ method: 'htr_sendNanoContractTx', params: { network: 'testnet' } });

    expect(handleRpcRequest).toHaveBeenCalledTimes(1);
  });

  test('shows the request nc_id on the confirmation screen', async () => {
    handleRpcRequest.mockImplementationOnce(async (request, _wallet, _data, promptHandler) => {
      // What the rpc handler sends: the whole request, with the oracle and the data as `data`.
      promptHandler({
        ...request,
        type: TriggerTypes.SignOracleDataConfirmationPrompt,
        data: { oracle: request.params.oracle, data: request.params.data },
      }, {});
      return { type: RpcResponseTypes.SignOracleDataResponse };
    });

    await run(oracleRequest({ nc_id: NC_ID }));

    expect(dispatched).toContainEqual(expect.objectContaining({
      type: types.SHOW_SIGN_ORACLE_DATA_REQUEST_MODAL,
      payload: expect.objectContaining({
        data: { oracle: ORACLE, data: 'result', ncId: NC_ID },
      }),
    }));
  });
});
