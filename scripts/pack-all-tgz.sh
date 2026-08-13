#!/usr/bin/env bash
# Pack every dsh-family and vendor-family package into dist/tgz as npm
# tarballs. Mirrors scripts/release/pack.ts but runs from bash so Windows
# drive-letter paths never confuse GNU tar, and pnpm's --pack-destination is
# always an absolute Windows-style path (pnpm resolves it relative to the
# package directory, and node cannot read MSYS /d/... paths).
#
# Usage: bash scripts/pack-all-tgz.sh [output-dir]   (default dist/tgz)
set -euo pipefail
REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
WIN_REPO="$(pwd -W 2>/dev/null || printf '%s' "$REPO")"
cd "$REPO"
if [[ "${1:-}" == "" ]]; then
  OUT="$WIN_REPO/dist/tgz"
elif [[ "$1" == /* || "$1" =~ ^[A-Za-z]: ]]; then
  OUT="$1"
else
  OUT="$WIN_REPO/$1"
fi
rm -rf "$OUT"
mkdir -p "$OUT"

pack_dir() {
  local dir="$1"
  if [[ ! -f "$dir/package.json" ]]; then
    echo "skip (no package.json): $dir" >&2
    return
  fi
  local priv
  priv=$(node -e "const p=require('./$dir/package.json'); process.stdout.write(p.private ? '1' : '0')" 2>/dev/null || echo 1)
  if [[ "$priv" == "1" ]]; then
    echo "skip (private): $dir" >&2
    return
  fi
  echo "pack: $dir" >&2
  pnpm --dir "$dir" pack --pack-destination "$OUT" >/dev/null
}

# dsh family: packages/*/*  and  apps/*
for m in packages/*/*/package.json; do
  [[ -f "$m" ]] && pack_dir "$(dirname "$m")"
done
for m in apps/*/package.json; do
  [[ -f "$m" ]] && pack_dir "$(dirname "$m")"
done

# vendor family: vendor/*
for m in vendor/*/package.json; do
  [[ -f "$m" ]] && pack_dir "$(dirname "$m")"
done

echo "DONE: $(find "$OUT" -name '*.tgz' | wc -l) tarballs in $OUT" >&2
