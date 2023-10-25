import React from 'react';
import { t } from 'ttag';
import { Image, Linking } from 'react-native';
import { useSelector } from 'react-redux';
import icShareActive from '../assets/icons/icShareActive.png';
import { ListButton } from './HathorList';
import { COLORS } from '../styles/themes';
import { combineURLs } from '../utils';

export function PublicExplorerListButton(props) {
  const { txId } = props;
  const explorerIcon = <Image source={icShareActive} width={24} height={24} />;
  const baseExplorerUrl = useSelector((state) => state.networkSettings.explorerUrl);
  const txUrl = `transaction/${txId}`;
  // XXX: maybe we should have this on the constants or utils to check the network
  const explorerLink = combineURLs(baseExplorerUrl, txUrl);

  return (
    <ListButton title={t`Public Explorer`} button={explorerIcon} onPress={() => { Linking.openURL(explorerLink); }} titleStyle={{ color: COLORS.textColorShadow }} isLast />
  );
}
