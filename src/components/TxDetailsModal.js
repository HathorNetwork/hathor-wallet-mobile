/**
 * Copyright (c) Hathor Labs and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import React, { Component } from 'react';
import {
  Text,
  StyleSheet,
  View,
  ScrollView,
  TouchableWithoutFeedback,
  Modal,
  Animated,
  Dimensions,
  PanResponder
} from 'react-native';
import { t } from 'ttag';

import { getShortContent, getShortHash, getTokenLabel, renderValue } from '../utils';
import { ListItem } from './HathorList';
import SlideIndicatorBar from './SlideIndicatorBar';
import CopyClipboard from './CopyClipboard';
import { PublicExplorerListButton } from './PublicExplorerListButton';
import { COLORS } from '../styles/themes';
import { TransactionStatusLabel } from './TransactionStatusLabel';

const { height: screenHeight } = Dimensions.get('window');

class TxDetailsModal extends Component {
  constructor(props) {
    super(props);
    this.slideAnim = new Animated.Value(screenHeight);
    this.gestureAnim = new Animated.Value(0);
    this.panResponder = PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_evt, gestureState) => (
        gestureState.dy > 10 && Math.abs(gestureState.dx) < Math.abs(gestureState.dy)
      ),
      onPanResponderMove: (_evt, gestureState) => {
        if (gestureState.dy > 0) {
          this.gestureAnim.setValue(gestureState.dy);
        }
      },
      onPanResponderRelease: (_evt, gestureState) => {
        if (gestureState.dy > 100 || gestureState.vy > 0.5) {
          // Threshold met - dismiss modal
          this.handleDismiss();
        } else {
          // Snap back to original position
          Animated.spring(this.gestureAnim, {
            toValue: 0,
            useNativeDriver: true,
          }).start();
        }
      },
    });
  }

  componentDidMount() {
    Animated.timing(this.slideAnim, {
      toValue: 0,
      duration: 300,
      useNativeDriver: true,
    }).start();
  }

  handleDismiss = () => {
    Animated.parallel([
      Animated.timing(this.slideAnim, {
        toValue: screenHeight,
        duration: 300,
        useNativeDriver: true,
      }),
      Animated.timing(this.gestureAnim, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      })
    ]).start(() => {
      this.props.onRequestClose();
    });
  };

  style = StyleSheet.create({
    backdrop: {
      flex: 1,
      backgroundColor: 'rgba(0, 0, 0, 0.5)',
    },
    container: {
      flex: 1,
      justifyContent: 'flex-end',
      paddingHorizontal: 8,
      paddingTop: 96,
    },
    inner: {
      borderRadius: 8,
      paddingBottom: 24,
      backgroundColor: COLORS.backgroundColor,
      maxHeight: '80%',
    },
  });

  getCopyClipboard = ({ text, copyText }) => (
    <CopyClipboard
      text={text}
      copyText={copyText}
      textStyle={{ fontSize: 16 }}
    />
  );

  render() {
    /**
     * @type {{
     *   token: unknown;
     *   tx: TxHistory;
     *   isNFT: boolean;
     * }} TxDetailsModal properties
     */
    const { token, tx, isNFT } = this.props;
    const { txId, ncId, ncMethod, ncCaller, isVoided } = tx;
    const ncCallerAddr = ncCaller && ncCaller.base58;

    const fullTokenStr = getTokenLabel(token);
    const description = tx.getDescription(token);
    const timestampStr = tx.getTimestampFormat();
    const shortTxId = getShortHash(txId, 7);
    const shortNcId = ncId && getShortHash(ncId, 7);
    const shortNcCallerAddr = ncCallerAddr && getShortContent(ncCallerAddr, 7);
    const txIdComponent = this.getCopyClipboard({
      text: shortTxId,
      copyText: txId
    });
    const ncIdComponent = ncId && this.getCopyClipboard({
      text: shortNcId,
      copyText: ncId
    });
    const ncCallerAddrComponent = ncCaller && this.getCopyClipboard({
      text: shortNcCallerAddr,
      copyText: ncCallerAddr
    });
    const isNc = tx.isNanoContract();
    const hasFirstBlock = tx.hasFirstBlock();

    const combinedTransform = Animated.add(this.slideAnim, this.gestureAnim);

    return (
      <Modal
        visible
        animationType='fade'
        transparent
        onRequestClose={this.handleDismiss}
      >
        <TouchableWithoutFeedback onPress={this.handleDismiss}>
          <View style={this.style.backdrop}>
            <Animated.View
              style={[
                this.style.container,
                {
                  transform: [{ translateY: combinedTransform }]
                }
              ]}
            >
              <View
                style={this.style.inner}
                {...this.panResponder.panHandlers}
              >
                <SlideIndicatorBar />
                <BalanceView tx={tx} token={token} isNFT={isNFT} />
                <ScrollView>
                  <View>
                    <ListItem title={t`Token`} text={fullTokenStr} />
                    <ListItem title={t`Description`} text={description} />
                    <ListItem title={t`Date & Time`} text={timestampStr} />
                    <ListItem title={t`Transaction ID`} text={txIdComponent} />
                    {isNc && (
                      <ListItem
                        title={t`Nano Contract Status`}
                        text={(
                          <TransactionStatusLabel
                            isVoided={isVoided}
                            hasFirstBlock={hasFirstBlock}
                          />
                        )}
                      />
                    )}
                    {isNc && <ListItem title={t`Blueprint Method`} text={ncMethod} />}
                    {isNc && <ListItem title={t`Nano Contract ID`} text={ncIdComponent} />}
                    {isNc && <ListItem title={t`Nano Contract Caller`} text={ncCallerAddrComponent} />}
                    {isNc && <PublicExplorerListButton txId={shortNcId} title={t`Nano Contract`} />}
                    <PublicExplorerListButton txId={tx.txId} />
                  </View>
                </ScrollView>
              </View>
            </Animated.View>
          </View>
        </TouchableWithoutFeedback>
      </Modal>
    );
  }
}

class BalanceView extends Component {
  style = StyleSheet.create({
    view: {
      marginTop: 32,
      marginBottom: 32,
      alignItems: 'center',
      paddingLeft: 54,
      paddingRight: 54,
    },
    balance: {
      fontSize: 32,
      fontWeight: 'bold',
    },
    text1: {
      paddingTop: 8,
      fontSize: 12,
      fontWeight: 'bold',
      color: COLORS.textColorShadow,
    },
  });

  render() {
    const { tx, isNFT } = this.props;
    const balanceStr = renderValue(tx.balance, isNFT);
    return (
      <View style={this.style.view}>
        <Text
          style={this.style.balance}
          adjustsFontSizeToFit
          minimumFontScale={0.5}
          numberOfLines={1}
        >
          {`${balanceStr} ${this.props.token.symbol}`}
        </Text>
        <Text style={this.style.text1}>{t`Amount`}</Text>
      </View>
    );
  }
}

export default TxDetailsModal;
