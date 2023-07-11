/**
 * Copyright (c) Hathor Labs and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { useEffect } from 'react';
import { useDispatch } from 'react-redux';
import { STORE } from '../store';

import { onExceptionCaptured } from '../actions';

/**
 * Only used for deciding which stack (App or Init) to display, so nothing is rendered.
 */
export function DecideStackScreen({ navigation }) {
  const dispatch = useDispatch();

  useEffect(() => {
    STORE
      .preStart()
      .then(() => STORE.walletIsLoaded())
      .then((isLoaded) => {
        if (isLoaded) {
          navigation.navigate('App');
        } else {
          navigation.navigate('Init');
        }
      }).catch((e) => {
        // The promise here is swallowing the error,
        // so we need to explicitly catch here.
        //
        // If we have a fail here, the wallet will
        // show up as if it was the first time it was
        // opened, so we need to capture and display
        // an error to give a chance for the user
        // to recover his loaded wallet.
        dispatch(onExceptionCaptured(e, true));
      });
  }, []);

  return null;
}

export default DecideStackScreen;
