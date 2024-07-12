/**
 * Copyright (c) Hathor Labs and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import React, { useEffect, useMemo } from 'react';
import {
  StyleSheet,
  View,
  TouchableOpacity,
} from 'react-native';
import { useDispatch, useSelector } from 'react-redux';
import { t } from 'ttag';
import { firstAddressRequest, nanoContractBlueprintInfoRequest } from '../../../actions';
import { NANOCONTRACT_BLUEPRINTINFO_STATUS } from '../../../constants';
import { COLORS } from '../../../styles/themes';
import { FrozenTextValue } from '../../FrozenTextValue';
import { CircleError } from '../../Icons/CircleError.icon';
import { NanoContractIcon } from '../../Icons/NanoContract.icon';
import { PenIcon } from '../../Icons/Pen.icon';
import Spinner from '../../Spinner';
import { TextValue } from '../../TextValue';
import { WarnTextValue } from '../../WarnTextValue';
import { commonStyles } from '../theme';

/**
 * It renders a card with basic information to execute the Nano Contract creation.
 *
 * @param {Object} props
 * @param {Object} props.nc Nano Contract info.
 * @param {() => void} props.onSelectAddress Callback fn for tap on caller address component.
 */
export const NanoContractExecInfo = ({ nc, onSelectAddress }) => {
  const dispatch = useDispatch();
  const registeredNc = useSelector((state) => state.nanoContract.registered[nc.ncId]);
  const blueprintInfo = useSelector((state) => state.nanoContract.blueprintInfo);
  const firstAddress = useSelector((state) => state.firstAddress);

  const isInitialize = nc.method === 'initialize';
  const notInitialize = !isInitialize;

  const blueprintName = useMemo(() => {
    if (notInitialize && registeredNc) {
      return registeredNc.blueprintName;
    }

    if (blueprintInfo.status === NANOCONTRACT_BLUEPRINTINFO_STATUS.SUCCESSFUL) {
      return blueprintInfo.data.name;
    }
    return null;
  }, [blueprintInfo]);

  useEffect(() => {
    if (isInitialize) {
      // If method is 'initialize' we don't have the nano contract registered,
      // therefore we need to request the blueprint info.
      dispatch(nanoContractBlueprintInfoRequest(nc.blueprintId));

      // Load firstAddress if not loaded
      if (!firstAddress.address) {
        dispatch(firstAddressRequest());
      }
    }
  }, [nc]);

  const isBlueprintInfoLoading = blueprintInfo.status === NANOCONTRACT_BLUEPRINTINFO_STATUS.LOADING;
  const hasBlueprintInfoFailed = blueprintInfo.status === NANOCONTRACT_BLUEPRINTINFO_STATUS.FAILED;

  const hasCaller = nc.caller != null;
  const hasFirstAddressFailed = !hasCaller && isInitialize && firstAddress.error;
  const isFirstAddressLoading = !hasCaller
                                && isInitialize
                                && !hasFirstAddressFailed;

  return (
    <View style={[commonStyles.card, commonStyles.cardSplit]}>
      <View style={commonStyles.cardSplitIcon}>
        <NanoContractIcon type='fill' color={COLORS.white} />
      </View>
      <View style={commonStyles.cardSplitContent}>
        {notInitialize && (
          <View>
            <TextValue label>{t`Nano Contract ID`}</TextValue>
            <FrozenTextValue>{nc.ncId}</FrozenTextValue>
          </View>
        )}
        <View>
          <TextValue label>{t`Blueprint ID`}</TextValue>
          <FrozenTextValue>{nc.blueprintId}</FrozenTextValue>
        </View>
        <View>
          <TextValue label>
            {t`Blueprint Name`}
            {isBlueprintInfoLoading && (
              <WarnTextValue>
                {' '}<Spinner size={14} />
              </WarnTextValue>
            )}
            {hasBlueprintInfoFailed && (
              <WarnTextValue>
                {' '}<CircleError size={14} />
              </WarnTextValue>
            )}
          </TextValue>
          {blueprintName && (
            <FrozenTextValue>{blueprintName}</FrozenTextValue>
          )}
          {isBlueprintInfoLoading && (
            <WarnTextValue>{t`Loading...`}</WarnTextValue>
          )}
          {hasBlueprintInfoFailed && (
            <WarnTextValue>{blueprintInfo.error}</WarnTextValue>
          )}
        </View>
        <View>
          <TextValue label>{t`Blueprint Method`}</TextValue>
          <FrozenTextValue>{nc.method}</FrozenTextValue>
        </View>
        <View style={commonStyles.cardSeparator} />
        <TouchableOpacity onPress={onSelectAddress}>
          <View style={styles.contentEditable}>
            <View style={styles.contentEditableValue}>
              <TextValue label>
                {t`Caller`}
                {isFirstAddressLoading && (
                  <WarnTextValue>
                    {' '}<Spinner size={14} />
                  </WarnTextValue>
                )}
                {(hasFirstAddressFailed) && (
                  <WarnTextValue>
                    {' '}<CircleError size={14} />
                  </WarnTextValue>
                )}
              </TextValue>
              {hasCaller && (
                <FrozenTextValue>{nc.caller || firstAddress.address}</FrozenTextValue>
              )}
              {isFirstAddressLoading && (
                <WarnTextValue>{t`Loading...`}</WarnTextValue>
              )}
              {hasFirstAddressFailed && (
                <WarnTextValue>{t`Couldn't determine address, select one`}</WarnTextValue>
              )}
            </View>
            <View style={styles.contentEditableIcon}>
              <PenIcon />
            </View>
          </View>
        </TouchableOpacity>
      </View>
    </View>
  )
};

const styles = StyleSheet.create({
  contentEditable: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  contentEditableValue: {
    flexShrink: 1,
    paddingRight: 8,
  },
  contentEditableIcon: {
    width: 24,
    paddingRight: 2,
  },
});
