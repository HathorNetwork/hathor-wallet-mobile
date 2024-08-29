#!/usr/bin/env bash

git apply enable-walletconnect.patch

npm install \
  @walletconnect/core@2.15.1\
  @walletconnect/web3wallet@1.14.1 \
  @ethersproject/shims@5.7.0 \
  @json-rpc-tools/utils@1.7.6 \
  @react-native-community/netinfo@11.3.1 \
  @walletconnect/react-native-compat@2.12.2 \
  ethers@6.13.2 \
  events@3.3.0 \
  fast-text-encoding@1.0.6 \
  react-native-get-random-values@1.11.0 \
  text-encoding@0.7.0

npm install && cd ios && pod install
