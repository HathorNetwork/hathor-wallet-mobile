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
      // Visible 1px ring around the whole card so the bottom edge
      // reads as "list ends here" — matches the figma settings card,
      // which has a thin border on all sides.
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: COLORS.borderColor,
      margin: 16,
      // Marginal vertical to match other listings; horizontal margin
      // 16 lines the card up with the section title below.
      shadowOffset: { height: 2, width: 0 },
      shadowRadius: 4,
      shadowColor: COLORS.textColor,
      shadowOpacity: 0.08,
    },
    title: {
      alignSelf: 'flex-start',
      // Align with the card's left edge (16 margin) instead of the
      // row content (16 margin + 16 row padding = 32). The figma puts
      // "GENERAL SETTINGS" flush to the card's outer left edge.
      paddingHorizontal: 16,
      // Add some breathing room above each section title so the
      // groups read as separate clusters.
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

    // Auto-mark the last visible child as `isLast` so its bottom border
    // line is removed and its bottom corners get rounded — matches the
    // figma settings card. Filtering out falsy children handles the
    // common conditional-render pattern (`flag && <ListMenu .../>`).
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

export class ListButton extends BaseItem {
  onPress = () => {
    if (this.props.onPress) {
      this.props.onPress();
    }
  }

  renderInside() {
    const borderStyles = this.getBorderStyles();
    return (
      <TouchableHighlight style={borderStyles} onPress={this.onPress}>
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
