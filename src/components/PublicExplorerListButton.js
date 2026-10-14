/**
 * Copyright (c) Hathor Labs and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import React from 'react';
import { t } from 'ttag';
import { Linking } from 'react-native';
import { useSelector } from 'react-redux';
import { ListButton } from './HathorList';
import { OpenInNewIcon } from './Icons/OpenInNew.icon';
import { COLORS } from '../styles/themes';
import { combineURLs } from '../utils';

const DEFAULT_TITLE = t`Public Explorer`;

export function PublicExplorerListButton({ txId, title }) {
  const explorerIcon = <OpenInNewIcon size={24} color={COLORS.black} />;
  const baseExplorerUrl = useSelector((state) => state.networkSettings.explorerUrl);
  const txUrl = `transaction/${txId}`;
  // XXX: maybe we should have this on the constants or utils to check the network
  const explorerLink = combineURLs(baseExplorerUrl, txUrl);

  return (
    <ListButton
      title={title || DEFAULT_TITLE}
      button={explorerIcon}
      onPress={() => { Linking.openURL(explorerLink) }}
      titleStyle={{ color: COLORS.textColorShadow }}
    />
  );
}
