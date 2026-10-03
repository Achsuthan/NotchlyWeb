#!/bin/bash
# Builds Notchly (Release) from the Xcode project and packages it as
# downloads/Notchly.dmg — the file every "Download" button on the site links to.
#
#   ./build-dmg.sh                       # project at ~/Desktop/Notchly
#   NOTCHLY_PROJECT=/path/to/Notchly ./build-dmg.sh
#
# The app is signed with whatever identity the Xcode project uses but is NOT
# notarized, so on other Macs Gatekeeper will warn on first open
# (right-click → Open). Notarize before distributing publicly.
set -euo pipefail

SITE_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="${NOTCHLY_PROJECT:-$HOME/Desktop/Notchly}"
WORK_DIR="$(mktemp -d)"
trap 'rm -rf "$WORK_DIR"' EXIT

echo "Building Notchly (Release) from ${PROJECT_DIR}…"
xcodebuild -project "$PROJECT_DIR/Notchly.xcodeproj" -scheme Notchly -configuration Release \
  -derivedDataPath "$WORK_DIR/build" build -quiet

APP="$WORK_DIR/build/Build/Products/Release/Notchly.app"
[ -d "$APP" ] || { echo "Build produced no Notchly.app" >&2; exit 1; }

# Disk image contents: the app plus an Applications shortcut to drag it onto.
STAGE="$WORK_DIR/dmg"
mkdir -p "$STAGE"
cp -R "$APP" "$STAGE/"
ln -s /Applications "$STAGE/Applications"

mkdir -p "$SITE_DIR/downloads"
hdiutil create -volname "Notchly" -srcfolder "$STAGE" -fs HFS+ -format UDZO -ov \
  "$SITE_DIR/downloads/Notchly.dmg" >/dev/null

echo "Wrote $SITE_DIR/downloads/Notchly.dmg ($(du -h "$SITE_DIR/downloads/Notchly.dmg" | cut -f1))"
