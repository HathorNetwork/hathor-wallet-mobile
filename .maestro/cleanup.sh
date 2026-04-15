#!/bin/bash
# Cleanup script for Maestro E2E development
# Closes DevTools windows, cleans Maestro outputs, reports memory

# Close Chrome DevTools windows
osascript -e 'tell application "Google Chrome" to close (every window whose title contains "DevTools")' 2>/dev/null

# Clean Maestro test outputs (screenshots, HTML reports)
rm -rf ~/.maestro/tests/20* 2>/dev/null

# Report memory pressure
memory_pressure 2>/dev/null | head -3

# Report Chrome window count
CHROME_WINDOWS=$(osascript -e 'tell application "Google Chrome" to count of windows' 2>/dev/null)
echo "Chrome windows: ${CHROME_WINDOWS:-N/A}"

# Report running heavy processes
echo "--- Heavy processes ---"
ps aux | grep -E "Simulator|Metro|react-native|maestro" | grep -v grep | awk '{printf "%-8s %5s%%mem  %s\n", $11, $4, $NF}'
