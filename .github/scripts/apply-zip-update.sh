#!/usr/bin/env bash
set -euo pipefail
if [ "$#" -ne 2 ]; then
  echo "Usage: apply-zip-update.sh <zip-file> <game-directory>" >&2
  exit 2
fi
ZIP_FILE=$(realpath "$1")
GAME_DIR=$(realpath -m "$2")
SCRIPT_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
if [ ! -f "$ZIP_FILE" ]; then
  echo "ZIP file not found: $ZIP_FILE" >&2
  exit 1
fi
while IFS= read -r entry; do
  entry=${entry%$'\r'}
  if [[ "$entry" == /* || "$entry" == ".." || "$entry" == ../* || "$entry" == */../* || "$entry" == */.. || "$entry" =~ ^[A-Za-z]: ]]; then
    echo "Unsafe path in ZIP: $entry" >&2
    exit 1
  fi
done < <(unzip -Z1 "$ZIP_FILE")
TEMP_DIR=$(mktemp -d)
trap 'rm -rf "$TEMP_DIR"' EXIT
ARCHIVE_DIR="$TEMP_DIR/archive"
WORKER_CONFIG_BACKUP="$TEMP_DIR/wrangler.jsonc"
NEXT_GAME_DIR="$TEMP_DIR/next-project"
mkdir -p "$ARCHIVE_DIR"
if [ -f "$GAME_DIR/wrangler.jsonc" ]; then
  cp "$GAME_DIR/wrangler.jsonc" "$WORKER_CONFIG_BACKUP"
fi
unzip -q -o "$ZIP_FILE" -d "$ARCHIVE_DIR"
VALID_PROJECTS=()
while IFS= read -r -d '' package_file; do
  candidate=$(dirname "$package_file")
  if [ -f "$candidate/wrangler.jsonc" ] \
    && [ -f "$candidate/public/index.html" ] \
    && [ -f "$candidate/src/index.js" ]; then
    VALID_PROJECTS+=("$candidate")
  fi
done < <(find "$ARCHIVE_DIR" -type f -name package.json -print0)
if [ "${#VALID_PROJECTS[@]}" -ne 1 ]; then
  echo "ZIP must contain exactly one valid project (package.json, wrangler.jsonc, public/index.html, and src/index.js)." >&2
  exit 1
fi
PROJECT_ROOT=${VALID_PROJECTS[0]}
if find "$PROJECT_ROOT" -type l -print -quit | grep -q .; then
  echo "ZIP project must not contain symbolic links." >&2
  exit 1
fi
# Prepare the complete release before replacing anything. Copying over the old
# tree leaves obsolete source files and tests mixed into the new release.
mkdir -p "$NEXT_GAME_DIR"
cp -a "$PROJECT_ROOT"/. "$NEXT_GAME_DIR"/
if [ -f "$WORKER_CONFIG_BACKUP" ]; then
  node "$SCRIPT_DIR/merge-worker-config.mjs" \
    "$WORKER_CONFIG_BACKUP" "$PROJECT_ROOT/wrangler.jsonc" \
    "$NEXT_GAME_DIR/wrangler.jsonc"
fi
mkdir -p "$(dirname "$GAME_DIR")"
if [ -e "$GAME_DIR" ]; then
  mv "$GAME_DIR" "$TEMP_DIR/previous-project"
fi
if ! mv "$NEXT_GAME_DIR" "$GAME_DIR"; then
  if [ -e "$TEMP_DIR/previous-project" ]; then
    mv "$TEMP_DIR/previous-project" "$GAME_DIR"
  fi
  echo "Unable to install the prepared project." >&2
  exit 1
fi
rm -f -- "$ZIP_FILE"
echo "ZIP update applied from: $PROJECT_ROOT"
