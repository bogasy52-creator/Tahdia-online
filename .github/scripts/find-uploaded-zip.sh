#!/usr/bin/env bash
set -euo pipefail

mapfile -d '' -t ZIPS < <(
  find . -maxdepth 1 -type f -iname '*.zip' -printf '%f\0' | LC_ALL=C sort -z
)

if [ "${#ZIPS[@]}" -ne 1 ]; then
  echo "Upload exactly one ZIP file to the repository root." >&2
  exit 1
fi

printf '%s\n' "${ZIPS[0]}"
