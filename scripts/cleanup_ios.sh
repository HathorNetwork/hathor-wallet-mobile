#!/bin/bash
# This script cleans every possible cache related to the iOS project.
# This is especially helpful during major dependency upgrades or to generate clean builds
# It must be run from the root folder of the project

set -e  # Exit immediately if a command exits with a non-zero status

# Check if the ios folder exists
if [ ! -d "ios" ]; then
  echo "❌ Error: 'ios' folder not found in the current directory. Are you in the project root?"
  exit 1
fi

# Navigate to the iOS directory
cd ios || exit

echo "🧹 Cleaning XCode caches..."
rm -rf build
xcodebuild clean

echo "🧹 Cleaning CocoaPods caches..."
rm -rf Pods
rm -rf ~/Library/Caches/CocoaPods


echo "🧹 Cleaning Xcode DerivedData..."
# Retrieve the project name by listing the *.xcodeproj directory, removing the extension,
# and handling errors if no match is found. That way, only the folders related to this project are cleaned up.
PROJECT_NAME=$(ls -d *.xcodeproj 2>/dev/null | sed 's/\.xcodeproj$//')
rm -rf ~/Library/Developer/Xcode/DerivedData/"$PROJECT_NAME"-*
rm -rf ~/Library/Developer/Xcode/Archives/"$PROJECT_NAME"-*

# Deintegrating CocoaPods. This will cause all pods to be re-downloaded upon the next install
# which will take a lot of bandwidth and processing time
echo "🧹 Deintegrating and cleaning CocoaPods..."
pod deintegrate


echo "✅ iOS project cleanup complete!"
