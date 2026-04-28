/**
 * Returns the root reducer's initial state for use in reducer tests.
 *
 * Always import the helper instead of redefining it per file — both the
 * testing-guide.md and prior code review have called out duplicated
 * setup as a smell.
 */
import { reducer } from '../../src/reducers/reducer';

export const getInitialState = () => reducer(undefined, { type: '@@INIT' });
