#!/bin/bash
#
# Script to release new versions for iOS and Android. After running it, you still
# have to build the project on XCode and Android Studio.
#
# This script expects a file `./env` with exported envvars.
#

set -e  # Exit on any command failure.
set -u  # Exit on unset variables.
set -v # Verbose mode for better debugging

rm -rf node_modules/

rm -f ./android/app/google-services.json
rm -f ./android/app/GoogleService-Info.plist
rm -f ./notifications/GoogleService-Info.plist

npm ci

(cd ios/ && pod install)

make i18n

source ./env
mkdir -p ./notifications
aws s3 cp ${HATHOR_WALLET_MOBILE_S3_PATH}/google-services.json ./android/app
aws s3 cp ${HATHOR_WALLET_MOBILE_S3_PATH}/GoogleService-Info.plist ./notifications/
