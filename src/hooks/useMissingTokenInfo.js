/**
 * Copyright (c) Hathor Labs and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { unregisteredTokensDownloadRequest } from '../actions';
import { DEFAULT_TOKEN } from '../constants';

/**
 * Custom hook to automatically fetch missing token info for unknown tokens
 * @param {Array} actions Array of action objects with token UIDs
 * @returns {Object} Combined tokens object with registered and unregistered tokens
 */
export const useMissingTokenInfo = (actions) => {
  const dispatch = useDispatch();
  const knownTokens = useSelector((state) => ({ ...state.tokens, ...state.unregisteredTokens }));

  // Request token data for unknown tokens
  useEffect(() => {
    const unknownTokensUid = [];
    const actionTokensUid = actions?.map((each) => each.token || each.uid) || [];

    actionTokensUid.forEach((uid) => {
      if (uid !== DEFAULT_TOKEN.uid && !(uid in knownTokens)) {
        unknownTokensUid.push(uid);
      }
    });

    if (unknownTokensUid.length > 0) {
      dispatch(unregisteredTokensDownloadRequest({ uids: unknownTokensUid }));
    }
  }, [actions, knownTokens, dispatch]);

  return knownTokens;
};
