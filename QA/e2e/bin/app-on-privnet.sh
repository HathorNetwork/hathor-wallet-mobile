#!/bin/bash
# Copyright (c) Hathor Labs and its affiliates.
#
# This source code is licensed under the MIT license found in the
# LICENSE file in the root directory of this source tree.

# Points the debug app on the emulator at the local privnet (../privnet) before it starts, by
# writing the custom network the app keeps in its storage. The app's first flag fetch then goes
# to the fake Unleash, so no flag from the real one (push notifications, say) is ever on.
#
#   app-on-privnet.sh [--fresh]   --fresh: wipe the app's data first (a new install, no wallet)
#
# Emulators only: store builds share this app id, so --fresh on a phone would erase its wallet.
# Needs the privnet running and an emulator image without Play Store, where adb can run as root:
# it writes into the app's storage as root, which works for release builds too (run-as needs a
# debuggable one). Uses adb from $ADB or the SDK.
set -euo pipefail
ADB=${ADB:-~/Android/Sdk/platform-tools/adb}
[ "$($ADB shell getprop ro.boot.qemu)" = 1 ] || { echo "app-on-privnet: emulators only" >&2; exit 1; }
APP=network.hathor.wallet
NODE_URL=http://localhost:18083/v1a/
NETWORK=$(curl -sf "${NODE_URL}status" | python3 -c 'import json, sys; print(json.load(sys.stdin)["server"]["network"])') \
  || { echo "app-on-privnet: no privnet at $NODE_URL (docker compose up -d in QA/e2e/privnet)" >&2; exit 1; }

# What the app saves after Settings > Network Settings > Customize with these URLs.
SETTINGS="{\"stage\":\"testnet\",\"network\":\"testnet\",\"fullNetwork\":\"$NETWORK\",\"nodeUrl\":\"$NODE_URL\""
SETTINGS+=",\"explorerUrl\":\"https://explorer.testnet.hathor.network/\""
SETTINGS+=",\"explorerServiceUrl\":\"https://explorer-service.testnet.hathor.network/\""
SETTINGS+=",\"txMiningServiceUrl\":\"http://localhost:18035/\",\"walletServiceUrl\":\"\",\"walletServiceWsUrl\":\"\"}"

# adbd restarts as root, which drops the reverse ports: set them after.
$ADB root >/dev/null
$ADB wait-for-device
$ADB shell am force-stop $APP
if [ "${1:-}" = --fresh ]; then $ADB shell pm clear $APP >/dev/null; fi
# 8081: Metro, for a debug build.
for port in 8081 18083 18035 18042; do $ADB reverse tcp:$port tcp:$port >/dev/null; done

# AsyncStorage's table as @react-native-async-storage creates it, and its schema version: it
# deletes a database without one and starts over.
SQL=$(mktemp)
trap 'rm -f "$SQL"' EXIT
printf '%s\n' \
  "PRAGMA user_version = 1;" \
  "CREATE TABLE IF NOT EXISTS catalystLocalStorage (key TEXT PRIMARY KEY, value TEXT NOT NULL);" \
  "INSERT OR REPLACE INTO catalystLocalStorage VALUES ('networkSettings:networkSettings', '$SETTINGS');" \
  > "$SQL"
$ADB push -q "$SQL" /data/local/tmp/e2e-network.sql
# Written as root, so hand the files to the app's user and give them the app's SELinux label.
DATA=/data/data/$APP
$ADB shell "mkdir -p $DATA/databases && sqlite3 $DATA/databases/RKStorage < /data/local/tmp/e2e-network.sql \
  && chown -R \$(stat -c %u:%g $DATA) $DATA/databases && restorecon -R $DATA/databases >/dev/null"
$ADB shell "sqlite3 $DATA/databases/RKStorage \"SELECT value FROM catalystLocalStorage WHERE key = 'networkSettings:networkSettings'\"" \
  | grep -q "\"fullNetwork\":\"$NETWORK\"" || { echo "app-on-privnet: the network was not written" >&2; exit 1; }
echo "app-on-privnet: the app starts on $NETWORK at $NODE_URL"
