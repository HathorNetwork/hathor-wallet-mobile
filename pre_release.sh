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

git log -n1

echo "🧹 Major cache and dependency cleanup..."
./scripts/cleanup.sh --ios --android

echo "🧹 Cleaning old GoogleService files..."
rm -f ./android/app/google-services.json
rm -f ./android/app/GoogleService-Info.plist
rm -f ./notifications/GoogleService-Info.plist

echo "📦 Reinstalling dependencies for release..."
npm run setup:release

echo "📦 Reinstalling pods..."
(cd ios/ && pod install)

echo "📝 Updating i18n..."
make i18n

echo "⬇️ Retrieving latest GoogleService files..."
source ./env
mkdir -p ./notifications
aws s3 cp ${HATHOR_WALLET_MOBILE_S3_PATH}/google-services.json ./android/app
aws s3 cp ${HATHOR_WALLET_MOBILE_S3_PATH}/GoogleService-Info.plist ./notifications/
