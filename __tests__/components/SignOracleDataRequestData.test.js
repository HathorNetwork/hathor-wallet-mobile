import { describe, test, expect } from '@jest/globals';
import React from 'react';
import { Text } from 'react-native';
import { act, create } from 'react-test-renderer';
import { SignOracleDataRequestData } from '../../src/components/Reown/SignOracleDataRequest';

const NC_ID = '000063f99b133c7630bc9d0117919f5b8726155412ad063dbbd618bdc7f85d7a';

describe('SignOracleDataRequestData', () => {
  test('shows the nano contract the data is signed for, then the oracle and the data', () => {
    let renderer;
    act(() => {
      renderer = create(
        <SignOracleDataRequestData
          ncId={NC_ID}
          oracle={{ raw: '76a914', isAddress: false }}
          data='result'
        />,
      );
    });

    const texts = renderer.root.findAllByType(Text)
      .map((node) => node.props.children)
      .filter((children) => typeof children === 'string');

    expect(texts).toEqual(['Nano Contract ID', NC_ID, 'Oracle', '76a914', 'Data', 'result']);
  });
});
