#!/bin/bash
# This script cleans every possible cache related to the project dependencies
# This is especially helpful during major dependency upgrades or to generate clean builds
# It must be run from the root folder of the project

set -e  # Exit immediately if a command exits with a non-zero status

# Parse parameters
CLEAN_IOS=false
CLEAN_ANDROID=false
REINSTALL=false

for arg in "$@"; do
  case $arg in
    --ios)
      CLEAN_IOS=true
      ;;
    --android)
      CLEAN_ANDROID=true
      ;;
    --reinstall)
      REINSTALL=true
      ;;
    *)
      echo "❌ Error: Unknown parameter '$arg'"
      exit 1
      ;;
  esac
done

# Check if the node_modules folder exists
if [ ! -d "node_modules" ]; then
  echo "❌ Error: 'node_modules' folder not found in the current directory. Are you in the project root?"
  exit 1
fi

echo "🧹 Cleaning node_modules..."
rm -rf node_modules

# Execute cleanup_ios.sh if --ios was provided
if $CLEAN_IOS; then
  echo "🧹 Cleaning iOS build artifacts..."
  ./scripts/cleanup_ios.sh
fi

# Execute cleanup_android.sh if --android was provided
if $CLEAN_ANDROID; then
  echo "🧹 Cleaning Android build artifacts..."
  ./scripts/cleanup_android.sh
fi

# Reinstall dependencies if --reinstall was provided
if $REINSTALL; then
  echo "📦 Reinstalling dependencies..."
  npm run setup

  if $CLEAN_IOS; then
    echo "🛠️ Rebuilding iOS artifacts..."
    cd ios
    pod install
    cd ..
  fi
fi

