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

/**
 * It renders a modal with some feedback to user.
 *
 * @param {Object} props
 *
 * @example
 * <FeedbackModal
 *   icon={(<Image source={errorIcon} resizeMode='contain' />)}
 *   text={t`Error while sending transaction.`}
 *   onDismiss={handleFeedbackModalDismiss}
 *   action={(<NewHathorButton discrete title={t`Ok, close`} onPress={handleErrorModalAction} />)}
 * />
 */
const FeedbackModal = (props) => (
  <HathorModal
    onDismiss={props.onDismiss}
  >
    {props.icon}
    <Text style={styles.content} {...props.textProps}>
      {props.text}
    </Text>
    {props.action
      && (
        <View style={styles.action}>
          {props.action}
        </View>
      )}
  </HathorModal>
);

const styles = {
  content: {
    fontSize: 18,
    lineHeight: 21,
    paddingTop: 36,
    textAlign: 'center',
  },
  action: {
    width: '100%',
    paddingTop: 8,
  },
};

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
