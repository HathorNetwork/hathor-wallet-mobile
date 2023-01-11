/**
 * Copyright (c) Hathor Labs and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import React, { useEffect } from 'react';
import { useDispatch } from 'react-redux';
import hathorLib from '@hathor/wallet-lib';

import { resetData } from '../actions';
import { useGlobalModalContext } from '../components/GlobalErrorModal';

/**
 * Only used for deciding which stack (App or Init) to display, so nothing is rendered.
 */
export function DecideStackScreen({ navigation }) {
  const dispatch = useDispatch();
  const globalModal = useGlobalModalContext();

  useEffect(() => {
    (async () => {
      dispatch(resetData());

      try {
        await hathorLib.storage.store.preStart();
      } catch (e) {
        globalModal.showModal(e.message, false);
      }

      if (hathorLib.wallet.loaded()) {
        navigation.navigate('App');
      } else {
        navigation.navigate('Init');
      }
    })();
  }, [dispatch]);

  return null;
}

export default DecideStackScreen;
