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
rm -rf ~/Library/Developer/Xcode/DerivedData/*
rm -rf ~/Library/Developer/Xcode/Archives/*

echo "🧹 Deintegrating and cleaning CocoaPods..."
pod deintegrate


echo "✅ iOS project cleanup complete!"
