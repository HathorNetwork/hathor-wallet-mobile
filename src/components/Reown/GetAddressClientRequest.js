/**
 * Copyright (c) Hathor Labs and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import React, { useEffect, useState } from 'react';
import {
  StyleSheet,
  View,
  ScrollView,
  TouchableWithoutFeedback,
  Text,
  TouchableHighlight,
  Image,
} from 'react-native';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigation } from '@react-navigation/native';
import { t } from 'ttag';
import { COLORS } from '../../styles/themes';
import NewHathorButton from '../NewHathorButton';
import { DappContainer } from './NanoContract/DappContainer';
import { commonStyles } from './theme';
import { WalletIcon } from '../Icons/Wallet.icon';
import { TextValue } from '../TextValue';
import { TextLabel } from '../TextLabel';
import { FeedbackContent } from '../FeedbackContent';
import SimpleButton from '../SimpleButton';
import Spinner from '../Spinner';
import errorIcon from '../../assets/images/icErrorBig.png';
import { selectAddressAddressesRequest } from '../../actions';

/**
 * Address item component for the address list
 */
const AddressItem = ({ item, isSelected, onSelectItem }) => {
  const onPress = () => {
    onSelectItem(item);
  };

  return (
    <TouchableHighlight
      onPress={onPress}
      underlayColor={COLORS.primaryOpacity30}
    >
      <View
        style={[
          styles.addressItemWrapper,
          isSelected && styles.addressItemSelected
        ]}
      >
        <View>
          <TextValue>{item.address}</TextValue>
          <TextLabel>{t`index`} {item.index}</TextLabel>
        </View>
      </View>
    </TouchableHighlight>
  );
};

export const GetAddressClientRequest = ({ getAddressClientRequest }) => {
  const { dapp, onAccept, onReject } = getAddressClientRequest;
  const dispatch = useDispatch();
  const navigation = useNavigation();
  const { addresses, error } = useSelector((state) => state.selectAddressModal);
  const [selectedItem, setSelectedItem] = useState(null);

  useEffect(() => {
    // Load addresses when component mounts
    dispatch(selectAddressAddressesRequest());
  }, [dispatch]);

  const onRetryLoadAddresses = () => {
    dispatch(selectAddressAddressesRequest());
  };

  const onSelectItem = (item) => {
    setSelectedItem(item);
  };

  const onAcceptRequest = () => {
    if (selectedItem && onAccept) {
      onAccept(selectedItem.address);
    }
    navigation.goBack();
  };

  const onDeclineRequest = () => {
    if (onReject) {
      onReject();
    }
    navigation.goBack();
  };

  const hasFailed = () => error;
  const isLoading = () => !error && addresses.length === 0;
  const hasLoaded = () => !error && addresses.length > 0;

  return (
    <ScrollView style={styles.wide} contentContainerStyle={styles.scrollContent}>
      <TouchableWithoutFeedback>
        <View style={styles.wrapper}>
          <View style={styles.content}>
            <DappContainer dapp={dapp} />

            {/* Main request information */}
            <View style={[commonStyles.card, styles.requestCard]}>
              <View style={styles.requestHeader}>
                <View style={styles.requestIconWrapper}>
                  <WalletIcon type='fill' color={COLORS.white} size={24} />
                </View>
                <View style={styles.requestTextWrapper}>
                  <Text style={styles.requestTitle}>{t`Select Address`}</Text>
                  <Text style={styles.requestDescription}>
                    {t`This app is requesting you to share an address from your wallet`}
                  </Text>
                </View>
              </View>
            </View>

            {/* Address selection */}
            <View style={[commonStyles.card, styles.addressListCard]}>
              {hasFailed() && (
                <FeedbackContent
                  icon={(<Image source={errorIcon} style={styles.feedbackContentIcon} resizeMode='contain' />)}
                  title={t`Load Addresses Error`}
                  message={error}
                  action={(<SimpleButton title={t`Retry`} onPress={onRetryLoadAddresses} />)}
                  offcard
                />
              )}
              {isLoading() && (
                <FeedbackContent
                  icon={(<Spinner size={48} />)}
                  title={t`Loading`}
                  message={t`Loading wallet addresses.`}
                  offcard
                />
              )}
              {hasLoaded() && (
                <>
                  <Text style={styles.addressListTitle}>{t`Select an address to share`}</Text>
                  <ScrollView
                    style={styles.addressListContainer}
                    nestedScrollEnabled
                    showsVerticalScrollIndicator
                  >
                    {addresses.map((item) => (
                      <AddressItem
                        key={item.address}
                        item={item}
                        isSelected={selectedItem?.address === item.address}
                        onSelectItem={onSelectItem}
                      />
                    ))}
                  </ScrollView>
                </>
              )}
            </View>

            {/* Privacy notice */}
            <View style={styles.privacyNotice}>
              <Text style={styles.privacyText}>
                {t`The app will receive the selected address. It cannot access your funds or make transactions without your approval.`}
              </Text>
            </View>

            {/* User actions */}
            <View style={styles.actionContainer}>
              <NewHathorButton
                title={t`Share Selected Address`}
                onPress={onAcceptRequest}
                disabled={!selectedItem}
              />
              <NewHathorButton
                title={t`Decline`}
                onPress={onDeclineRequest}
                secondary
                danger
              />
            </View>
          </View>
        </View>
      </TouchableWithoutFeedback>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  wide: {
    width: '100%'
  },
  scrollContent: {
    flexGrow: 1,
  },
  wrapper: {
    flex: 1,
    paddingHorizontal: 16,
    backgroundColor: COLORS.lowContrastDetail,
  },
  content: {
    flex: 1,
    rowGap: 16,
    width: '100%',
    paddingVertical: 16,
  },
  actionContainer: {
    flexDirection: 'column',
    gap: 8,
    paddingBottom: 48,
    marginTop: 8,
  },
  requestCard: {
    padding: 16,
    backgroundColor: COLORS.primaryOpacity10,
  },
  requestHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  requestIconWrapper: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  requestTextWrapper: {
    flex: 1,
  },
  requestTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: COLORS.textColor,
    marginBottom: 4,
  },
  requestDescription: {
    fontSize: 14,
    color: COLORS.textColorShadow,
    lineHeight: 20,
  },
  addressListCard: {
    padding: 16,
  },
  addressListTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: COLORS.textColor,
    marginBottom: 12,
  },
  addressListContainer: {
    maxHeight: 280,
  },
  addressItemWrapper: {
    paddingVertical: 16,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderRadius: 8,
    marginBottom: 4,
  },
  addressItemSelected: {
    backgroundColor: COLORS.primaryOpacity10,
    borderWidth: 1,
    borderColor: COLORS.primary,
  },
  feedbackContentIcon: {
    height: 36,
    width: 36,
  },
  privacyNotice: {
    backgroundColor: COLORS.cardBackground,
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.borderColor,
  },
  privacyText: {
    fontSize: 13,
    color: COLORS.textColorShadow,
    lineHeight: 18,
    textAlign: 'center',
  },
});
