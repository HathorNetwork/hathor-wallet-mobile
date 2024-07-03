import { applyMiddleware, legacy_createStore as createStore } from 'redux';
import createSagaMiddleware from 'redux-saga';
import thunk from 'redux-thunk';
import { reducer } from './reducer';
import rootSagas from '../sagas';

const saga = createSagaMiddleware();
const middlewares = [
  saga,
  thunk,
];

export const store = createStore(reducer, applyMiddleware(...middlewares));

saga.run(rootSagas);
