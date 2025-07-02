/**
 * Copyright (c) Hathor Labs and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import {
  StyleSheet,
  View,
} from 'react-native';
import PropTypes from 'prop-types';
import BackdropModal from './BackdropModal';
import { COLORS } from '../styles/themes';

const HathorModal = (props) => (
  <BackdropModal
    visible
    animationType='slide'
    position='bottom'
    enableSwipeToDismiss
    enableBackdropPress
    onDismiss={props.onDismiss}
    contentStyle={styles.view}
  >
    <View style={StyleSheet.compose(styles.innerView, props.viewStyle)}>
      {props.children}
    </View>
  </BackdropModal>
);

const styles = StyleSheet.create({
  view: {
    backgroundColor: COLORS.backgroundColor,
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingBottom: 24,
    paddingTop: 42,
    minHeight: 290,
    alignItems: 'center',
  },
  innerView: {
    width: '100%',
    alignItems: 'center',
  },
});

HathorModal.propTypes = {
  // Function to execute on dismissing the modal
  onDismiss: PropTypes.func,
  // Children to be rendered inside the modal
  // It can be any renderable type
  children: PropTypes.node.isRequired,
  // The inner view style
  // eslint-disable-next-line react/forbid-prop-types
  viewStyle: PropTypes.object,
};

export default HathorModal;
