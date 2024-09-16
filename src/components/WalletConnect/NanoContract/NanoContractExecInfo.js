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
import { firstAddressRequest } from '../../../actions';
import { NANOCONTRACT_BLUEPRINTINFO_STATUS as STATUS } from '../../../constants';
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
  const blueprintInfo = useSelector((state) => state.nanoContract.blueprint[nc.blueprintId]);
  const firstAddress = useSelector((state) => state.firstAddress);

  const isInitialize = nc.method === 'initialize';
  const notInitialize = !isInitialize;

  const blueprintName = useMemo(() => {
    if (notInitialize && registeredNc) {
      return registeredNc.blueprintName;
    }

    if (blueprintInfo?.status === STATUS.SUCCESSFUL) {
      return blueprintInfo.data.name;
    }
    return null;
  }, [blueprintInfo]);

  useEffect(() => {
    if (isInitialize) {
      // Load firstAddress if not loaded
      if (!firstAddress.address) {
        dispatch(firstAddressRequest());
      }
    }
  }, [nc]);

  const isBlueprintInfoLoading = !registeredNc
                                 && blueprintInfo?.status === STATUS.LOADING;
  const hasBlueprintInfoFailed = !registeredNc
                                 && blueprintInfo?.status === STATUS.FAILED;

  const hasCaller = nc.caller != null;
  const hasFirstAddressFailed = !hasCaller || firstAddress.error;

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
                {' '}<Spinner size={14} animating />
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
                {(hasFirstAddressFailed) && (
                  <WarnTextValue>
                    {' '}<CircleError size={14} />
                  </WarnTextValue>
                )}
              </TextValue>
              {hasCaller && (
                <FrozenTextValue>{nc.caller || firstAddress.address}</FrozenTextValue>
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
