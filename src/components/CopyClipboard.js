/**
 * Copyright (c) Hathor Labs and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import React from 'react';
import PropTypes from 'prop-types';
import {
  Clipboard, StyleSheet, Text,
} from 'react-native';
import { t } from 'ttag';
import { PRIMARY_COLOR } from '../constants';

class CopyClipboard extends React.Component {
  static defaultProps = {
    copiedTimeout: 1500,
  };

  /**
   * copying {boolean} If is copying address (if should show copied feedback)
   */
  state = {
    copying: false,
  };

  textCopy = () => {
    Clipboard.setString(this.props.text);
    this.setState({ copying: true }, () => {
      setTimeout(() => this.setState({ copying: false }), this.props.copiedTimeout);
    });
  }

  render() {
    if (this.state.copying) {
      return <Text style={[style.text, style.copied]}>{t`Copied to clipboard!`}</Text>;
    }
    return (
      <Text
        onPress={this.textCopy}
        onLongPress={this.textCopy}
        style={[style.text, this.props.textStyle]}
      >
        {this.props.text}
      </Text>
    );
  }
}

CopyClipboard.propTypes = {
  // The text to be copied
  text: PropTypes.string.isRequired,

  // Style of the text component
  textStyle: Text.propTypes.style,

  // Timeout in milliseconds that copied message is shown (default is 1500)
  copiedTimeout: PropTypes.number,
};

const style = StyleSheet.create({
  text: {
    fontSize: 13,
  },
  copied: {
    color: PRIMARY_COLOR,
  },
});

export default CopyClipboard;
