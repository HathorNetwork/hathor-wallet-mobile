/**
 * Copyright (c) Hathor Labs and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import React from 'react';
import { t } from 'ttag';
import {
  Image
} from 'react-native';
import hathorLib from '@hathor/wallet-lib';
import PropTypes from 'prop-types';
import FeedbackModal from './FeedbackModal';
import Spinner from './Spinner';
// import { MIN_JOB_ESTIMATION } from '../constants';
import checkIcon from '../assets/images/icCheckBig.png';
import errorIcon from '../assets/images/icErrorBig.png';

class SendTransactionFeedbackModal extends React.Component {
  /**
   * miningEstimation {Number} Estimated seconds to complete the job
   * jobID {String} Mining job ID
   * success {boolean} If succeeded to mine and propagate the tx
   * sending {boolean} If is executing any request (mining or propagating)
   * errorMessage {string} Message to be shown to the user in case of error
   */
  state = {
    miningEstimation: null,
    jobDone: false,
    success: false,
    sending: true,
    errorMessage: '',
  }

  componentDidMount = () => {
    // Start event listeners
    this.addSendTxEventHandlers();
  }

  /**
   * Create event listeners for all sendTransaction events
   */
  addSendTxEventHandlers = () => {
    this.props.sendTransaction.on('job-submitted', this.updateEstimation);
    this.props.sendTransaction.on('estimation-updated', this.updateEstimation);
    this.props.sendTransaction.on('job-done', this.jobDone);
    this.props.promise.then((tx) => {
      this.onSendSuccess(tx);
    }, (err) => {
      this.onSendError(err.message);
    });
  }

  /**
   * Executed after tx is propagated to the network with success
   * Update component states and call success method, if exists
   *
   * @param {Object} tx Transaction data
   */
  onSendSuccess = (tx) => {
    this.setState({ sending: false, success: true, errorMessage: '' });
    if (this.props.onTxSuccess) {
      this.props.onTxSuccess(tx);
    }
  }

  /**
   * Executed when there is an error while sending the tx
   * Update component states and call error method, if exists
   *
   * @param {String} message Error message
   */
  onSendError = (message) => {
    this.setState({ sending: false, success: false, errorMessage: message });
    if (this.props.onTxError) {
      this.props.onTxError(message);
    }
  }

  /**
   * Method executed after the mining job is done
   *
   * @param {Object} data Object with jobID
   */
  jobDone = (data) => {
    this.setState({ miningEstimation: null, jobDone: true });
  }

  /**
   * Method executed when the estimation-updated event is received
   * Update the state with the new estimation
   *
   * @param {Object} data Object with jobID and estimation
   */
  updateEstimation = (data) => {
    this.setState({ miningEstimation: data.estimation });
  }

  /**
   * Called when the success modal is dismissed
   * If there is a dismiss success method, execute it
   */
  onDismissSuccessModal = () => {
    if (this.props.onDismissSuccess) {
      this.props.onDismissSuccess();
    }
  }

  /**
   * Called when the error modal is dismissed
   * If there is a dismiss error method, execute it
   */
  onDismissErrorModal = () => {
    if (this.props.onDismissError) {
      this.props.onDismissError();
    }
  }

  render() {
    if (this.props.hide) {
      return null;
    }

    const renderModal = () => {
      // Is sending tx
      if (this.state.sending) {
        return (
          <FeedbackModal
            text={getSendingModalText()}
            icon={<Spinner />}
          />
        );
      }

      // Already sent and it's success
      if (this.state.success) {
        return (
          <FeedbackModal
            icon={<Image source={checkIcon} style={{ height: 105, width: 105 }} resizeMode='contain' />}
            text={this.props.successText}
            onDismiss={this.onDismissSuccessModal}
          />
        );
      }

      // Error
      return (
        <FeedbackModal
          icon={<Image source={errorIcon} style={{ height: 105, width: 105 }} resizeMode='contain' />}
          text={this.state.errorMessage}
          onDismiss={this.onDismissErrorModal}
          textProps={{ numberOfLines: 2 }}
        />
      );
    };

    const getSendingModalText = () => {
      let secondaryText = '';
      if (this.state.jobDone) {
        secondaryText = t`Propagating transaction to the network.`;
      } else if (this.state.miningEstimation) {
        // const estimation = Math.max(Math.ceil(this.state.miningEstimation), MIN_JOB_ESTIMATION);
        // secondaryText = t`Estimated time: ${estimation}s`;
      }
      return `${this.props.text}\n\n${secondaryText}`;
    };

    return renderModal();
  }
}

SendTransactionFeedbackModal.defaultProps = {
  hide: false,
};

SendTransactionFeedbackModal.propTypes = {
  // Text displayed on the first line of the modal
  text: PropTypes.oneOfType([PropTypes.string, PropTypes.element]).isRequired,
  // lib object that handles the mining/propagation requests and emit events
  sendTransaction: PropTypes.oneOfType([
    PropTypes.instanceOf(hathorLib.SendTransaction),
    PropTypes.instanceOf(hathorLib.SendTransactionWalletService)
  ]).isRequired,
  // optional method to be executed when the tx is mined and propagated with success
  onTxSuccess: PropTypes.func,
  // optional method to be executed when an error happens while sending the tx
  onTxError: PropTypes.func,
  // optional method to be executed when the success modal is dismissed
  onDismissSuccess: PropTypes.func,
  // optional method to be executed when the error modal is dismissed
  onDismissError: PropTypes.func,
  hide: PropTypes.bool,
};

export default SendTransactionFeedbackModal;
