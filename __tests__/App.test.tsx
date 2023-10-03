/* eslint-disable */
import 'react-native';
import { it, jest } from '@jest/globals';

import React from 'react';
import App from '../src/App';

// Note: test renderer must be required after react-native.
import renderer from 'react-test-renderer';

jest.mock('redux-saga', () => () => ({ run: jest.fn() }));
jest.mock('redux', () => ({
  createStore: jest.fn(),
  applyMiddleware: jest.fn(),
}));

it('renders correctly', () => {
  renderer.create(<App />);
});
