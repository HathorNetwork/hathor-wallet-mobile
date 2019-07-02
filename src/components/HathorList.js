import React, { Component } from 'react';

import {
  Text,
  TouchableHighlight,
  StyleSheet,
  View,
  Image,
  Share,
} from 'react-native';

export class HathorList extends Component {
  style = StyleSheet.create({
    view: {
      alignSelf: 'stretch',
      backgroundColor: 'white',
      borderRadius: 8,
      margin: 16,
      shadowOffset: { height: 2, width: 0 },
      shadowRadius: 4,
      shadowColor: 'black',
      shadowOpacity: 0.08,
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

    return (
      <View style={style}>
        {this.props.children}
      </View>
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
      borderColor: '#eee',
      borderBottomWidth: 1,
    },
    lastItemContainer: {
      borderBottomWidth: 0,
    },
    firstItemView: {
      borderTopLeftRadius: 8,
      borderTopRightRadius: 8,
    },
    lastItemView: {
      borderBottomLeftRadius: 8,
      borderBottomRightRadius: 8,
    },
    view: {
      flexDirection: 'row',
      backgroundColor: 'white',
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
      color: 'rgba(0, 0, 0, 0.5)',
    },
  }));

  renderInside() {
    const { style } = this;
    return (
      <View style={[this.style.view, ...this.getBorderStyles()]}>
        {this.props.title && <Text style={[style.title, this.props.titleStyle]}>{this.props.title}</Text>}
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
    this.props.onPress && this.props.onPress();
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
    this.props.onPress && this.props.onPress();
  }

  render() {
    return (
      <ListButton
        button={<Image source={require('../assets/icons/chevron-right.png')} width={24} height={24} />}
        {...this.props}
      />
    );
  }
}
