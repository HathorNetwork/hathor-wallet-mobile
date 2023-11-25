#!/usr/bin/env bash

git apply enable-walletconnect.patch

npm install && cd ios && pod install
