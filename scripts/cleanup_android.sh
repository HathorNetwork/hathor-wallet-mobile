#!/bin/bash
# This script cleans every possible cache related to the Android project.
# This is especially helpful during major dependency upgrades or to generate clean builds
# It must be run from the root folder of the project

set -e  # Exit immediately if a command exits with a non-zero status

# Check if the ios folder exists
if [ ! -d "android" ]; then
  echo "❌ Error: 'android' folder not found in the current directory. Are you in the project root?"
  exit 1
fi

# Clear all builds within the project
echo "🧹 Cleaning Application build caches..."
cd android || exit
rm -rf .gradle
rm -rf build
rm -rf app/build

# Clear global android cache of NDK's
# This will force a re-download of every NDK version
echo "🧹 Cleaning and forcing re-download of global SDK/NDK caches..."
rm -rf ~/Android/Sdk/ndk/*

# Clear all leaking gradle processes
# ⚠️ Warning! This will stop any ongoing Gradle processes! Run only if you aren't using any!
echo "🧹 Killing all Gradle processes to avoid leaks..."
./gradlew --stop
pkill -9 -f gradle
