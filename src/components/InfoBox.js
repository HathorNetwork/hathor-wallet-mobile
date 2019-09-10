/**
 * Copyright (c) Hathor Labs and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import React from 'react';
import { StyleSheet, View } from 'react-native';
import PropTypes from 'prop-types';

const InfoBox = (props) => {
  /* eslint-disable react/no-array-index-key */
  const items = props.items.map((item, index) => (
    React.cloneElement(item, { style: [styles.text, item.style], key: index })
  ));

  return (
    <View style={styles.wrapper}>
      {items}
    </View>
  );
};

InfoBox.propTypes = {
  // The lines to display on this InfoBox
  items: PropTypes.arrayOf(PropTypes.element).isRequired,
};

const styles = StyleSheet.create({
  text: {
    fontSize: 14,
    lineHeight: 24,
    color: 'rgba(0, 0, 0, 0.5)',
  },
  wrapper: {
    marginVertical: 16,
    padding: 16,
    backgroundColor: '#f7f7f7',
    borderRadius: 8,
  },
});

export default InfoBox;
