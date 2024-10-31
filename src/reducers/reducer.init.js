/**
 * Copyright (c) Hathor Labs and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import {
  applyMiddleware,
  // createStore is deprecated, the new recommended way to use redux is by using
  // redux-toolkit, more on this at
  // https://redux.js.org/introduction/why-rtk-is-redux-today
  legacy_createStore as createStore,
} from 'redux';
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
