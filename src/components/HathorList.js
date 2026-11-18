/**
 * Copyright (c) Hathor Labs and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import React, { Component } from 'react';
import {
  Text,
  TouchableHighlight,
  StyleSheet,
  View,
  Image,
} from 'react-native';

import chevronRight from '../assets/icons/chevron-right.png';
import { COLORS } from '../styles/themes';

const defaultRadius = 16;

export class HathorList extends Component {
  style = StyleSheet.create({
    view: {
      alignSelf: 'stretch',
      backgroundColor: COLORS.backgroundColor,
      borderRadius: defaultRadius,
      // A hairline ring around the whole card, so its edges show where the list ends.
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: COLORS.borderColor,
      margin: 16,
      shadowOffset: { height: 2, width: 0 },
      shadowRadius: 4,
      shadowColor: COLORS.textColor,
      shadowOpacity: 0.08,
    },
    title: {
      alignSelf: 'flex-start',
      // Flush with the card's left edge, its 16 margin, rather than with the rows' content.
      paddingHorizontal: 16,
      // Room above each section title, so the sections read as separate groups.
      marginTop: 8,
      fontSize: 14,
      // HSL is preferable than RGB because it allows an
      // easier manipulation in arithmetic fashion.
      // The following color is Black with 55% of light,
      // which yields a tone of grey.
      color: 'hsl(0, 0%, 55%)',
    },
    infinityView: {
      flex: 1,
      marginBottom: 0,
      borderBottomLeftRadius: 0,
      borderBottomRightRadius: 0,
      paddingBottom: 16,
    },
  });

  render() {
    const style = [this.style.view];

    if (this.props.infinity) {
      style.push(this.style.infinityView);
    }

    // The last child that renders is marked `isLast`, so the last row has no bottom line and its
    // bottom corners are round. The children a flag hides (`flag && <ListMenu />`) are skipped.
    const validChildren = React.Children.toArray(this.props.children).filter(Boolean);
    const lastIdx = validChildren.length - 1;
    const decoratedChildren = validChildren.map((child, idx) => (
      idx === lastIdx && React.isValidElement(child)
        ? React.cloneElement(child, { isLast: true })
        : child
    ));

    return (
      <>
        {this.props.title && <Text style={[this.style.title]}>{this.props.title}</Text>}
        <View style={style}>
          {decoratedChildren}
        </View>
      </>
    );
  }
}

class BaseItem extends Component {
  static defaultProps = {
    isFirst: false,
    isLast: false,
  };

  style = StyleSheet.create({
    container: {
      borderColor: COLORS.borderColor,
      borderBottomWidth: 1,
    },
    lastItemContainer: {
      borderBottomWidth: 0,
    },
    firstItemView: {
      borderTopLeftRadius: defaultRadius,
      borderTopRightRadius: defaultRadius,
    },
    lastItemView: {
      borderBottomLeftRadius: defaultRadius,
      borderBottomRightRadius: defaultRadius,
    },
    view: {
      flexDirection: 'row',
      backgroundColor: COLORS.backgroundColor,
      alignItems: 'center',
      height: 64,
      paddingLeft: 16,
      paddingRight: 16,
    },
    title: {
      flex: 1,
      fontSize: 14,
    },
    text: {
      fontSize: 16,
    },
  });

  getBorderStyles() {
    const style = [];
    if (this.props.isFirst) {
      style.push(this.style.firstItemView);
    }
    if (this.props.isLast) {
      style.push(this.style.lastItemView);
    }
    return style;
  }

  render() {
    const style = [this.style.container];
    if (this.props.isLast) {
      style.push(this.style.lastItemContainer);
    }
    return (
      <View style={style}>
        {this.renderInside()}
      </View>
    );
  }
}

export class ListItem extends BaseItem {
  style = Object.assign(this.style, StyleSheet.create({
    title: {
      ...this.style.title,
      color: COLORS.textColorShadow,
    },
  }));

  renderInside() {
    const { style } = this;
    return (
      <View style={[this.style.view, ...this.getBorderStyles()]}>
        {this.props.title
          && <Text style={[style.title, this.props.titleStyle]}>{this.props.title}</Text>}
        {(typeof (this.props.text) === 'string'
          ? <Text style={style.text}>{this.props.text}</Text>
          : this.props.text
        )}
      </View>
    );
  }
}

/**
 * A pressable row. With `disabled`, it ignores presses, as while what it acts on is loading.
 */
export class ListButton extends BaseItem {
  onPress = () => {
    if (this.props.onPress && !this.props.disabled) {
      this.props.onPress();
    }
  }

  renderInside() {
    const borderStyles = this.getBorderStyles();
    return (
      <TouchableHighlight
        style={borderStyles}
        onPress={this.onPress}
        disabled={Boolean(this.props.disabled)}
      >
        <View style={[this.style.view, ...borderStyles]}>
          {(typeof (this.props.title) === 'string'
            ? <Text style={[this.style.title, this.props.titleStyle]}>{this.props.title}</Text>
            : this.props.title
          )}
          {this.props.button}
        </View>
      </TouchableHighlight>
    );
  }
}

export class ListMenu extends Component {
  onPress = () => {
    if (this.props.onPress) {
      this.props.onPress();
    }
  }

  render() {
    return (
      <ListButton
        button={<Image source={chevronRight} width={24} height={24} />}
        {...this.props}
      />
    );
  }
}
