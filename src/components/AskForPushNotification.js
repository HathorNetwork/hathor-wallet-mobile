import React from 'react';
import { connect } from 'react-redux';
import { t } from 'ttag';
import ActionModal from './ActionModal';
import { pushDismissOptInQuestion } from '../actions';

const mapStateToProps = (state) => ({
  optInDismissed: state.pushNotification.optInQuestionDismissed,
});

const mapDispatchToProps = (dispatch) => ({
  dismissOptInQuestion: () => dispatch(pushDismissOptInQuestion()),
});

const onEnablePushNotifications = (props) => {
  props.navigation.navigate('PushNotification');
  props.dismissOptInQuestion();
};

function AskForPushNotification(props) {
  if (props.optInDismissed) return null;
  return (
    <ActionModal
      title={t`Do you want to enable push notifications for this wallet?`}
      message={t`You can always change this later in the settings menu.`}
      button={t`Yes, enable`}
      onAction={() => onEnablePushNotifications(props)}
      onDismiss={() => props.dismissOptInQuestion()}
    />
  );
}

export default connect(mapStateToProps, mapDispatchToProps)(AskForPushNotification);
