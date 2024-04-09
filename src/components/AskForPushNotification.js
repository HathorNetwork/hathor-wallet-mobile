import React from 'react';
import { StyleSheet, Text } from 'react-native';
import { useDispatch, useSelector } from 'react-redux';
import { t } from 'ttag';
import { pushDismissOptInQuestion } from '../actions';
import { ModalBase } from './ModalBase.component';

export default function AskForPushNotification(props) {
  const showOptIn = useSelector((state) => state.pushNotification.showOptInQuestion);
  const dispatch = useDispatch();

  const onEnablePushNotifications = () => {
    props.navigation.navigate('PushNotification');
    dispatch(pushDismissOptInQuestion());
  };

  const putDismissOptInQuestion = () => {
    dispatch(pushDismissOptInQuestion());
  };

  return (
    <ModalBase show={showOptIn} onDismiss={putDismissOptInQuestion}>
      <ModalBase.Title>{t`Do you want to enable push notifications for this wallet?`}</ModalBase.Title>
      <ModalBase.Body style={styles.body}>
        <Text style={[styles.text]}>{t`You can always change this later in the settings menu.`}</Text>
      </ModalBase.Body>
      <ModalBase.Button
        title={t`Yes, enable`}
        onPress={onEnablePushNotifications}
      />
      <ModalBase.DiscreteButton
        title={t`No, not now`}
        onPress={putDismissOptInQuestion}
      />
    </ModalBase>
  );
}

const styles = StyleSheet.create({
  body: {
    paddingBottom: 20,
  },
  fieldContainer: {
    width: '100%',
    paddingBottom: 4,
  },
  text: {
    fontSize: 14,
    lineHeight: 20,
  },
});
