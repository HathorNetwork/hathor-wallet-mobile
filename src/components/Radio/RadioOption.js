/**
 * Copyright (c) Hathor Labs and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
} from 'react-native';
import { COLORS } from '../../styles/themes';
import RadioButton from './RadioButton';

/**
 * A selectable row: a radio circle beside a title (with an optional badge),
 * an optional description, and an optional muted italic hint.
 *
 * @param {Object} props
 * @param {boolean} props.selected
 * @param {Function} props.onPress
 * @param {boolean} [props.disabled] - Non-interactive; the title greys out.
 * @param {string} props.title
 * @param {string} [props.badge] - Pill text shown at the right of the title row.
 * @param {string} [props.description]
 * @param {string} [props.hint] - Muted italic line below the description.
 */
export default function RadioOption({
  selected,
  onPress,
  disabled = false,
  title,
  badge,
  description,
  hint,
}) {
  const titleColor = disabled ? COLORS.midContrastDetail : COLORS.black;
  return (
    <TouchableOpacity
      activeOpacity={disabled ? 1 : 0.7}
      onPress={onPress}
      disabled={disabled}
      style={styles.option}
    >
      <RadioButton selected={selected} disabled={disabled} />
      <View style={styles.textWrapper}>
        <View style={styles.titleRow}>
          <Text style={[styles.title, { color: titleColor }]}>{title}</Text>
          {badge != null && (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{badge}</Text>
            </View>
          )}
        </View>
        {description != null && (
          <Text style={styles.description}>{description}</Text>
        )}
        {hint != null && <Text style={styles.hint}>{hint}</Text>}
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  option: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  textWrapper: {
    flex: 1,
    marginLeft: 16,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  title: {
    fontSize: 16,
    fontWeight: '600',
  },
  badge: {
    backgroundColor: COLORS.lowContrastDetail,
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 2,
  },
  badgeText: {
    fontSize: 12,
    color: COLORS.darkContrastDetail,
  },
  description: {
    marginTop: 4,
    fontSize: 12,
    lineHeight: 20,
    color: COLORS.midContrastDetail,
  },
  hint: {
    marginTop: 4,
    fontSize: 12,
    lineHeight: 20,
    fontStyle: 'italic',
    color: COLORS.darkContrastDetail,
  },
});
