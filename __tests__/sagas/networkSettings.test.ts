import * as nsSaga from '../../src/sagas/networkSettings';
import * as sagaHelpers from '../../src/sagas/helpers';
import { all, effectTypes, fork } from 'redux-saga/effects';
import createSagaMiddleware, { END, runSaga } from 'redux-saga';
import { applyMiddleware, createStore } from 'redux';
import { reducer } from '../../src/reducer';
import { networkSettingsUpdate, networkSettingsUpdateSuccess, reloadWalletRequested, types } from '../../src/actions';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { networkSettingsKey } from '../../src/constants';
import { STORE } from '../../src/store';
import { config } from '@hathor/wallet-lib';

beforeEach(() => {
    jest.clearAllMocks();
});

describe('updateNetworkSettings', () => {
    beforeAll(() => {
        jest.spyOn(config, 'getExplorerServiceBaseUrl').mockReturnValue('');
        jest.spyOn(config, 'getServerUrl');
        jest.spyOn(config, 'getWalletServiceBaseUrl').mockReturnValue('');
        jest.spyOn(config, 'getWalletServiceBaseWsUrl').mockReturnValue('');;
    })

    it('should fail with invalid input', async () => {
        const actual: string[] = [];
        // simulates saga cluster in sagas/index.js
        const sagas = [nsSaga.saga];
        function* defaultSaga() {
            yield all(
                sagas.map((saga) => fork(saga))
            );
        }

        // effect middleware used to control effect behavior
        const effectMiddleware = next => effect => {
            if (effect.type === effectTypes.PUT && effect.payload.action.type === types.NETWORKSETTINGS_UPDATE_FAILURE) {
                actual.push('failed')
            }
            return next(effect);
        }

        const middleware = createSagaMiddleware({ effectMiddlewares: [effectMiddleware] });
        const store = createStore(reducer, {}, applyMiddleware(middleware));

        const task = middleware.run(defaultSaga);

        Promise.resolve()
            .then(() => store.dispatch(networkSettingsUpdate(null)))
            .then(() => store.dispatch(networkSettingsUpdate(undefined)))
            .then(() => store.dispatch(networkSettingsUpdate({})))
            .then(() => store.dispatch(networkSettingsUpdate({ explorerUrl: undefined })))
            .then(() => store.dispatch(networkSettingsUpdate({ explorerUrl: null })))
            .then(() => store.dispatch(networkSettingsUpdate({ explorerUrl: '' })))
            .then(() => store.dispatch(networkSettingsUpdate({ explorerUrl: 1 })))
            .then(() => store.dispatch(networkSettingsUpdate({ explorerUrl: 'invalid.url.com' })))
            // explorerUrl is valid, however it must have at least nodeUrl
            .then(() => store.dispatch(networkSettingsUpdate({ explorerUrl: 'http://localhost:8081/' })))
            // explorerUrl is valid, but nodeUrl is empty
            .then(() => store.dispatch(networkSettingsUpdate({
                explorerUrl: 'http://localhost:8081/',
                nodeUrl: '',
            })))
            // explorerUrl is valid, but nodeUrl is invalid 
            .then(() => store.dispatch(networkSettingsUpdate({
                explorerUrl: 'http://localhost:8081/',
                nodeUrl: 'invalid.url.com'
            })))
            // both explorerUrl and nodeUrl are valid, but waletService is invalid
            .then(() => store.dispatch(networkSettingsUpdate({
                explorerUrl: 'http://localhost:8081/',
                nodeUrl: 'http://localhost:3000/',
                walletServiceUrl: 'invalid.url.com'
            })))
            // both explorerUrl and walletService are valid, however the required nodeUrl is invalid
            .then(() => store.dispatch(networkSettingsUpdate({
                explorerUrl: 'http://localhost:8081/',
                nodeUrl:'invalid.url.com',
                walletServiceUrl: 'http://localhost:8081/'
            })))
            .then(() => store.dispatch(END))

        await task.toPromise()
        expect(actual).toEqual([
            'failed',
            'failed',
            'failed',
            'failed',
            'failed',
            'failed',
            'failed',
            'failed',
            'failed',
            'failed',
            'failed',
            'failed',
            'failed'
        ])
    });

    it('should fetch network from wallet-service or fullnode', async () => {
        const actual: any[] = [];
        // simulates saga cluster in sagas/index.js
        const sagas = [nsSaga.saga];
        function* defaultSaga() {
            yield all(
                sagas.map((saga) => fork(saga))
            );
        }

        // effect middleware used to control effect behavior
        const effectMiddleware = next => effect => {
            if (effect.type === effectTypes.PUT && effect.payload.action.type === types.NETWORKSETTINGS_UPDATE_FAILURE) {
                actual.push('failed')
            }
            if (effect.type === effectTypes.PUT && effect.payload.action.type === types.NETWORKSETTINGS_UPDATE_SUCCESS) {
                actual.push(effect.payload.action.payload)
            }
            return next(effect);
        }

        const middleware = createSagaMiddleware({ effectMiddlewares: [effectMiddleware] });
        const store = createStore(reducer, {}, applyMiddleware(middleware));

        const task = middleware.run(defaultSaga);


        const getWalletServiceNetwork = jest.spyOn(sagaHelpers, 'getWalletServiceNetwork');
        getWalletServiceNetwork.mockResolvedValue('mainnet');

        const getFullnodeNetwork = jest.spyOn(sagaHelpers, 'getFullnodeNetwork');
        getFullnodeNetwork
            .mockImplementationOnce(() => Promise.resolve('testnet'))
            .mockImplementationOnce(() => Promise.resolve('privnet'))
            .mockImplementationOnce(() => Promise.reject(new Error('invalid request')));

        Promise.resolve()
            .then(() => store.dispatch(networkSettingsUpdate({
                explorerUrl: 'http://localhost:8081/',
                nodeUrl: 'http://localhost:3000/',
            })))
            .then(() => store.dispatch(networkSettingsUpdate({
                explorerUrl: 'http://localhost:8081/',
                nodeUrl: 'http://localhost:3000/',
                walletServiceUrl: 'http://localhost:8080/'
            })))
            .then(() => store.dispatch(networkSettingsUpdate({
                explorerUrl: 'http://localhost:8081/',
                nodeUrl: 'http://localhost:3000/',
            })))
            // here the getFullnodeNetwork rejects throwing an error
            .then(() => store.dispatch(networkSettingsUpdate({
                explorerUrl: 'http://localhost:8081/',
                nodeUrl: 'http://localhost:3000/',
            })))
            .then(() => store.dispatch(END))

        await task.toPromise()
        expect(actual).toEqual([
            {
                stage: 'testnet',
                network: 'testnet',
                explorerUrl: 'http://localhost:8081/',
                nodeUrl: 'http://localhost:3000/',
                walletServiceUrl: undefined,
                walletServiceWsUrl: undefined
            },
            {
                stage: 'mainnet',
                network: 'mainnet',
                explorerUrl: 'http://localhost:8081/',
                nodeUrl: 'http://localhost:3000/',
                walletServiceUrl: 'http://localhost:8080/',
                walletServiceWsUrl: 'ws://ws.localhost:8080/'
            },
            {
                stage: 'dev-privnet',
                network: 'privnet',
                explorerUrl: 'http://localhost:8081/',
                nodeUrl: 'http://localhost:3000/',
                walletServiceUrl: undefined,
                walletServiceWsUrl: undefined
            },
            'failed'
        ])
    });

});

describe('persistNetworkSettings', () => {
    it('should persist networkSettings and trigger feature toggle update', async () => {
        const actual: any[] = [];
        // simulates saga cluster in sagas/index.js
        const sagas = [nsSaga.saga];
        function* defaultSaga() {
            yield all(
                sagas.map((saga) => fork(saga))
            );
        }

        // effect middleware used to control effect behavior
        const effectMiddleware = next => effect => {
            if (effect.type === effectTypes.PUT && effect.payload.action.type === types.FEATURE_TOGGLE_UPDATE) {
                actual.push('update')
            }
            return next(effect);
        }

        const middleware = createSagaMiddleware({ effectMiddlewares: [effectMiddleware] });
        const store = createStore(reducer, {}, applyMiddleware(middleware));

        const task = middleware.run(defaultSaga);

        const spyStorage = jest.spyOn(AsyncStorage, 'setItem');

        const networkSettingsPayload = {
            stage: 'testnet',
            network: 'testnet',
            explorerUrl: 'http://localhost:8081/',
            nodeUrl: 'http://localhost:3000/',
            walletServiceUrl: undefined,
            walletServiceWsUrl: undefined
        };

        Promise.resolve()
            .then(() => store.dispatch(networkSettingsUpdateSuccess(networkSettingsPayload)))
            .then(() => store.dispatch(END))


        await task.toPromise()

        const expectedStoredValue = JSON.stringify(networkSettingsPayload);
        expect(spyStorage).toBeCalledTimes(1);
        expect(spyStorage).toBeCalledWith(networkSettingsKey.networkSettings, expectedStoredValue);

        const expectedState = {
            networkSettings: networkSettingsPayload
        };
        expect(store.getState()).toEqual(expectedState);

        expect(actual).toEqual([
            'update',
        ])
    });
});

describe('cleanNetworkSettings', () => {
    it('should clean persisted network settings', () => {
        const spyRemove = jest.spyOn(STORE, 'removeItem')
        runSaga(
            {
                dispatch: jest.fn(),
                getState: jest.fn(),
            },
            nsSaga.cleanNetworkSettings
        )
        expect(spyRemove).toBeCalledTimes(1);
        expect(spyRemove).toBeCalledWith(networkSettingsKey.networkSettings);
    });
});
