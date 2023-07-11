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
import { TextPropTypes } from 'deprecated-react-native-prop-types';
import { PRIMARY_COLOR } from '../constants';

class CopyClipboard extends React.Component {
  static defaultProps = {
    copiedTimeout: 1500,
  };

  timeoutRef = null;

  /**
   * copying {boolean} If is copying address (if should show copied feedback)
   */
  state = {
    copying: false,
  };

  componentWillUnmount() {
    if (this.timeoutRef) {
      clearTimeout(this.timeoutRef);
    }
  }

  textCopy = () => {
    Clipboard.setString(this.props.copyText || this.props.text);
    this.setState({ copying: true }, () => {
      this.timeoutRef = setTimeout(
        () => this.setState(
          {
            copying: false
          }
        ),
        this.props.copiedTimeout
      );
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
  // The text to be displayed. If copyText is not set, it's also the copied text
  text: PropTypes.string.isRequired,

  // The text to be copied. If not set, text will be used
  copyText: PropTypes.string,

  // Style of the text component
  textStyle: TextPropTypes.style,

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
