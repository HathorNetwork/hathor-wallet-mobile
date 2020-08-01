/**
 * Copyright (c) Hathor Labs and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import React from 'react';
import {
  StyleSheet, Text, View,
} from 'react-native';
import Modal from 'react-native-modal';
import { connect } from 'react-redux';
import { t } from 'ttag';

/**
 * showErrorModal {boolean} If should show error modal
 * errorReported {boolean} If user reported the error to Sentry
 */
const mapStateToProps = (state) => ({
  showErrorModal: state.showErrorModal,
  errorReported: state.errorReported,
});

const showErrorReportedMessage = () => (
  <Text style={styles.text}>
    {t`Thanks for reporting the error to the team. We will investigate it to prevent from happening again.`}
  </Text>
);

const ErrorModal = (props) => (
  <Modal
    isVisible={props.showErrorModal}
    animationIn='slideInUp'
    style={styles.modal}
  >
    <View style={styles.innerModal}>
      <Text style={styles.title}>
        {t`Unexpected error`}
      </Text>
      {props.errorReported && showErrorReportedMessage()}
      <Text style={styles.text}>
        {t`Please restart your app to continue using the wallet.`}
      </Text>
    </View>
  </Modal>
);

const styles = StyleSheet.create({
  modal: {
    justifyContent: 'flex-end',
  },
  innerModal: {
    backgroundColor: '#fff',
    borderRadius: 8,
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 56,
    paddingTop: 48,
    height: 290,
  },
  text: {
    fontSize: 18,
    textAlign: 'center',
    marginBottom: 24,
  },
  title: {
    fontWeight: 'bold',
    fontSize: 20,
    textAlign: 'center',
    marginBottom: 24,
  }
});

export default connect(mapStateToProps)(ErrorModal);
