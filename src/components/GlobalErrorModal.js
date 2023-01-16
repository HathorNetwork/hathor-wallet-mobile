/**
 * Copyright (c) Hathor Labs and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import React, { useState, createContext, useContext } from 'react';
import { Alert, View } from 'react-native';
import { t } from 'ttag';
import { setErrorModal } from '../actions';
import { sentryReportError } from '../errorHandler';

const initialState = {
  showModal: () => {},
  hideModal: () => {},
  modalHidden: true,
  data: {},
  error: null,
};

export const GlobalModalContext = createContext(initialState);

export const useGlobalModalContext = () => useContext(GlobalModalContext);

export const GlobalModal = ({ children, store }) => {
  const [data, setData] = useState(initialState);

  const hideModal = () => {
    setData({
      ...data,
      modalHidden: true,
      error: null,
      modalProps: {},
    });
  };

  const showModal = (fatal, error, modalProps = {}) => {
    setData({
      ...data,
      modalHidden: false,
      modalProps,
      fatal,
      error,
    });
  };

  const renderComponent = () => {
    const {
      modalHidden,
      fatal,
      error,
    } = data;

    if (modalHidden) {
      return null;
    }

    return (
      <>
        {Alert.alert(
          t`Unexpected error occurred`,
          t`Unfortunately an unhandled error happened and you will need to restart your app.\n\nWe kindly ask you to report this error to the Hathor team clicking on the button below.\n\nNo sensitive data will be shared.`,
          [{
            text: t`Report error`,
            onPress: () => {
              sentryReportError(error);
              store.dispatch(setErrorModal(true, fatal));
            },
          }, {
            text: t`Close`,
            onPress: () => {
              store.dispatch(setErrorModal(false, fatal));
            }
          }],
          { cancelable: false },
        )}
      </>
    );
  };

  return (
    <GlobalModalContext.Provider value={{
      data,
      showModal,
      hideModal,
    }}
    >
      { renderComponent() }
      { children }
    </GlobalModalContext.Provider>
  );
};
