/* eslint-disable max-len */
/**
 * Copyright (c) Hathor Labs and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import React from 'react';
import {
  Text, View,
} from 'react-native';
import PropTypes from 'prop-types';
import NewHathorButton from './NewHathorButton';
import HathorModal from './HathorModal';

const ActionModal = (props) => (
  <HathorModal onDismiss={props.onDismiss}>
    <View style={{ alignItems: 'center' }}>
      <Text style={{ fontSize: 18, marginTop: 20, textAlign: 'center' }}>
        {props.title}
      </Text>
      <Text style={{ fontSize: 14, marginTop: 20, textAlign: 'center' }} {...props.textProps}>
        {props.text}
      </Text>
    </View>
    <View style={{ width: '100%', justifyContent: 'flex-end', marginTop: 60 }}>
      <NewHathorButton onPress={() => props.onAction()} title={props.button} />
    </View>
  </HathorModal>
);

ActionModal.propTypes = {
  // Title of the modal
  title: PropTypes.string.isRequired,

  // Text to display in the body of the modal
  text: PropTypes.oneOfType([PropTypes.string, PropTypes.element]).isRequired,

  // Props to be passed to the text component as an object
  // eslint-disable-next-line react/forbid-prop-types
  textProps: PropTypes.object,

  // Function to execute on dismissing the modal
  onDismiss: PropTypes.func.isRequired,

  // Text to display on the button
  button: PropTypes.string.isRequired,

  // Function to execute on pressing the button
  onAction: PropTypes.func.isRequired,
};

export default ActionModal;
