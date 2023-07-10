#!/usr/bin/env bash

git apply enable-walletconnect.patch
npm install @walletconnect/core@2.7.6 @walletconnect/web3wallet@1.4.0

cd ios && pod install
