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
# Needs a debuggable build (run-as) and the privnet running. Uses adb from $ADB or the SDK.
set -euo pipefail
ADB=${ADB:-~/Android/Sdk/platform-tools/adb}
APP=network.hathor.wallet
NODE_URL=http://localhost:18083/v1a/
NETWORK=$(curl -sf "${NODE_URL}status" | python3 -c 'import json, sys; print(json.load(sys.stdin)["server"]["network"])') \
  || { echo "app-on-privnet: no privnet at $NODE_URL (docker compose up -d in QA/e2e/privnet)" >&2; exit 1; }

# What the app saves after Settings > Network Settings > Customize with these URLs.
SETTINGS="{\"stage\":\"testnet\",\"network\":\"testnet\",\"fullNetwork\":\"$NETWORK\",\"nodeUrl\":\"$NODE_URL\""
SETTINGS+=",\"explorerUrl\":\"https://explorer.testnet.hathor.network/\""
SETTINGS+=",\"explorerServiceUrl\":\"https://explorer-service.testnet.hathor.network/\""
SETTINGS+=",\"txMiningServiceUrl\":\"http://localhost:18035/\",\"walletServiceUrl\":\"\",\"walletServiceWsUrl\":\"\"}"

$ADB shell am force-stop $APP
if [ "${1:-}" = --fresh ]; then $ADB shell pm clear $APP >/dev/null; fi
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
$ADB push "$SQL" /data/local/tmp/e2e-network.sql >/dev/null
$ADB shell "run-as $APP mkdir -p databases && run-as $APP sqlite3 databases/RKStorage < /data/local/tmp/e2e-network.sql"
$ADB shell "run-as $APP sqlite3 databases/RKStorage \"SELECT value FROM catalystLocalStorage WHERE key = 'networkSettings:networkSettings'\"" \
  | grep -q "\"fullNetwork\":\"$NETWORK\"" || { echo "app-on-privnet: the network was not written" >&2; exit 1; }
echo "app-on-privnet: the app starts on $NETWORK at $NODE_URL"
