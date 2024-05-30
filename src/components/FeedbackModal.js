/**
 * Copyright (c) Hathor Labs and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import React from 'react';
import { Text, View } from 'react-native';
import PropTypes from 'prop-types';
import HathorModal from './HathorModal';

const FeedbackModal = (props) => (
  <HathorModal onDismiss={props.onDismiss}>
    {props.icon}
    <Text style={{ fontSize: 18, marginTop: 40, textAlign: 'center' }} {...props.textProps}>
      {props.text}
    </Text>
    {props.action
      && (
        <View style={{ width: '100%', marginTop: 8 }}>
          {props.action}
        </View>
      )}
  </HathorModal>
);

FeedbackModal.propTypes = {
  // Icon used on this modal. Usually an image or the Spinner component
  icon: PropTypes.element.isRequired,

  // Text displayed on the modal
  text: PropTypes.oneOfType([PropTypes.string, PropTypes.element]).isRequired,

  // Function to execute on dismissing the modal
  onDismiss: PropTypes.func,

  action: PropTypes.element,
};

export default FeedbackModal;
