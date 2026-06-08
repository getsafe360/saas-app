#!/usr/bin/env bash
# Build the GetSafe 360 AI Connector plugin ZIP.
# Run from the saas-ux/public/wp-plugin/ directory or from anywhere — this
# script resolves its own location.
#
# Usage:
#   ./build.sh                  → getsafe360-connector.zip
#   ./build.sh --tag v0.4.0     → also prints the WP_PLUGIN_DOWNLOAD_URL hint
#
# After building, set WP_PLUGIN_DOWNLOAD_URL in your Vercel env to:
#   https://www.getsafe360.ai/wp-plugin/getsafe360-connector.zip
# (or upload the ZIP to Vercel Blob and use the blob URL for immutable releases)

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

ZIP_NAME="getsafe360-connector.zip"
TAG="${2:-}"

echo "Building $ZIP_NAME …"

rm -f "$ZIP_NAME"

zip -r "$ZIP_NAME" \
  getsafe360-connector.php \
  languages/ \
  --exclude "*.DS_Store" \
  --exclude "__MACOSX/*"

SIZE=$(du -sh "$ZIP_NAME" | cut -f1)
echo "✓ $ZIP_NAME ($SIZE)"

if [[ -n "$TAG" ]]; then
  echo ""
  echo "WP_PLUGIN_DOWNLOAD_URL hint:"
  echo "  https://www.getsafe360.ai/wp-plugin/getsafe360-connector.zip"
fi
