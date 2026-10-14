import { describe, it, expect } from '@jest/globals';
import { reducer } from '../../src/reducers/reducer';
import { setAmountFormat } from '../../src/actions';
import { AMOUNT_FORMAT, AMOUNT_FORMAT_DEFAULT } from '../../src/constants';

// initialState is not exported; derive it by initializing the reducer.
const getInitialState = () => reducer(undefined, { type: '@@INIT' });

describe('amountFormat reducer', () => {
  it('defaults to the expanded format', () => {
    expect(getInitialState().amountFormat).toBe(AMOUNT_FORMAT_DEFAULT);
  });

  it('sets the amount format', () => {
    const next = reducer(getInitialState(), setAmountFormat(AMOUNT_FORMAT.COMPRESSED));
    expect(next.amountFormat).toBe(AMOUNT_FORMAT.COMPRESSED);
  });
});
