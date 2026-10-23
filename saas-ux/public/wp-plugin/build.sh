#!/usr/bin/env bash
# Build the GetSafe 360 AI Connector plugin ZIP.
#
# The ZIP must contain a single top-level directory named after the plugin
# slug:
#
#   getsafe360-connector/
#   ├── getsafe360-connector.php
#   └── languages/…
#
# Two things went wrong with the previously committed ZIP:
#
#   1. It was built on Windows and stored paths with backslashes
#      ("languages\getsafe360-connector-de_DE.mo"). WordPress unzips those as
#      files whose *name* contains a backslash rather than as a directory, so
#      every translation silently failed to load.
#   2. It had no top-level plugin directory — the PHP file and the language
#      entries sat at the archive root. WordPress derives the installed folder
#      from the archive structure, and the auto-updater replaces the plugin
#      *folder*, so an archive without one cannot update cleanly.
#
# This script stages the files into a correctly named directory and zips that,
# which makes both problems impossible to reintroduce.
#
# Usage:
#   ./build.sh                  → getsafe360-connector.zip
#   ./build.sh --tag v1.4.0     → also prints the WP_PLUGIN_DOWNLOAD_URL hint
#
# After building, set WP_PLUGIN_DOWNLOAD_URL in your Vercel env to:
#   https://www.getsafe360.ai/wp-plugin/getsafe360-connector.zip

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

SLUG="getsafe360-connector"
ZIP_NAME="$SLUG.zip"
TAG="${2:-}"

PLUGIN_VERSION="$(grep -m1 -oE '^\s*\*\s*Version:\s*\S+' "$SLUG.php" | awk '{print $NF}')"
echo "Building $ZIP_NAME (plugin version $PLUGIN_VERSION) …"

STAGE="$(mktemp -d)"
trap 'rm -rf "$STAGE"' EXIT

mkdir -p "$STAGE/$SLUG"
cp "$SLUG.php" "$STAGE/$SLUG/"
if [[ -d languages ]]; then
  mkdir -p "$STAGE/$SLUG/languages"
  cp languages/*.mo languages/*.po languages/*.pot "$STAGE/$SLUG/languages/" 2>/dev/null || true
fi

rm -f "$ZIP_NAME"
( cd "$STAGE" && zip -rq "$SCRIPT_DIR/$ZIP_NAME" "$SLUG" -x "*.DS_Store" -x "__MACOSX/*" )

# Guard against the two historical failure modes.
if unzip -l "$ZIP_NAME" | grep -q '\\'; then
  echo "ERROR: archive contains backslash paths — build it on Linux/macOS or in WSL." >&2
  exit 1
fi
if ! unzip -l "$ZIP_NAME" | grep -q " $SLUG/$SLUG.php$"; then
  echo "ERROR: archive is missing $SLUG/$SLUG.php at the expected path." >&2
  exit 1
fi

SIZE=$(du -sh "$ZIP_NAME" | cut -f1)
echo "✓ $ZIP_NAME ($SIZE)"
unzip -l "$ZIP_NAME" | tail -n +4 | head -n -2

if [[ -n "$TAG" ]]; then
  echo ""
  echo "WP_PLUGIN_DOWNLOAD_URL hint:"
  echo "  https://www.getsafe360.ai/wp-plugin/$ZIP_NAME"
  echo "Remember to bump PLUGIN_VERSION in app/api/wp-plugin/info/route.ts to $PLUGIN_VERSION."
fi
