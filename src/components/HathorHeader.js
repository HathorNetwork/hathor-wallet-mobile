/**
 * Copyright (c) Hathor Labs and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import React from 'react';
import {
  Image, StyleSheet, Text, TouchableOpacity, View,
} from 'react-native';

import SimpleButton from './SimpleButton';
import Logo from './Logo';
import chevronLeft from '../assets/icons/chevron-left.png';
import closeIcon from '../assets/icons/icCloseActive.png';
import { COLORS, STYLE } from '../styles/themes';

const HathorHeader = ({
  title,
  rightElement,
  withLogo,
  withBorder,
  onBackPress,
  onCancel,
  wrapperStyle,
  children,
}) => {
  const hasChildren = children != null;
  const left = React.Children.toArray(children).find(
    (child) => child.type.displayName === HathorHeaderLeft.displayName
  );
  const right = React.Children.toArray(children).find(
    (child) => child.type.displayName === HathorHeaderRight.displayName
  );

  return (
    <Wrapper withBorder={withBorder} style={wrapperStyle}>
      {hasChildren
          && (
          <InnerWrapper>
            {left}
            {right}
          </InnerWrapper>
          )}
      {!hasChildren
          && (
          <InnerWrapper>
            <LeftComponent onBackPress={onBackPress} />
            <CentralComponent title={title} withLogo={withLogo} />
            <RightComponent rightElement={rightElement} onCancel={onCancel} />
          </InnerWrapper>
          )}
    </Wrapper>
  );
};

const Wrapper = ({ withBorder, style, children }) => (
  <View style={[styles.wrapper, style, withBorder && styles.wrapperWithBorder]}>
    {children}
  </View>
);

const InnerWrapper = ({ children }) => (
  <View style={styles.innerWrapper}>
    {children}
  </View>
);

const HathorHeaderLeft = ({ children }) => (<View>{children}</View>);
HathorHeaderLeft.displayName = 'HathorHeaderLeft';

const HathorHeaderRight = ({ children }) => <View>{children}</View>;
HathorHeaderRight.displayName = 'HathorHeaderRight';

HathorHeader.Left = HathorHeaderLeft;
HathorHeader.Right = HathorHeaderRight;

const CancelButton = ({ onCancel }) => (
  <SimpleButton
    icon={closeIcon}
    onPress={onCancel}
  />
);

const LeftComponent = ({ onBackPress }) => {
  if (onBackPress) {
    return (
      <View style={[styles.iconWrapper, styles.iconWrapperStart]}>
        <TouchableOpacity onPress={onBackPress}>
          <Image source={chevronLeft} width={24} height={24} />
        </TouchableOpacity>
      </View>
    );
  }
  return <View style={styles.iconWrapper} />;
};

const CentralComponent = ({ title, withLogo }) => {
  if (withLogo) {
    return (
      <Logo
        style={styles.centralComponentLogo}
      />
    );
  }
  return <Text>{title}</Text>;
};

const RightComponent = ({ rightElement, onCancel }) => {
  const element = (onCancel ? <CancelButton onCancel={onCancel} /> : rightElement);
  return (
    <View style={[styles.iconWrapper, styles.iconWrapperEnd]}>
      {element}
    </View>
  );
};

const styles = StyleSheet.create({
  wrapper: {
    height: STYLE.headerHeight,
    flexDirection: 'row',
    alignItems: 'flex-end',
    borderColor: COLORS.borderColor,
    paddingHorizontal: 16,
  },
  wrapperWithBorder: {
    borderBottomWidth: 1,
  },
  innerWrapper: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8
  },
  iconWrapper: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconWrapperStart: {
    justifyContent: 'flex-start',
  },
  iconWrapperEnd: {
    justifyContent: 'flex-end',
  },
  centralComponentLogo: {
    height: 22,
    width: 100,
  },
});

export default HathorHeader;
