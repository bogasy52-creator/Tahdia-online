#!/usr/bin/env bash
set -euo pipefail

if [ "$#" -ne 1 ]; then
  echo "Usage: verify-project-update.sh <project-directory>" >&2
  exit 2
fi

PROJECT_DIR=$(realpath "$1")
if [ ! -f "$PROJECT_DIR/package.json" ]; then
  echo "Project package.json not found: $PROJECT_DIR" >&2
  exit 1
fi

cd "$PROJECT_DIR"
npm install --include=dev --no-audit --no-fund
npm run verify
