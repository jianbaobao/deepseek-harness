#!/usr/bin/env bash
# Build a .deb package from a portable bundle (with bundled Node runtime).
# Usage: bash scripts/package-deb.sh <version> [bundle-dir]
#   bundle-dir default: dist/linux-bundle  (layout: node/, node_modules/, dsh, README.txt)
set -euo pipefail
REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO"
VERSION="${1:?usage: package-deb.sh <version> [bundle-dir]}"
BUNDLE="${2:-dist/linux-bundle}"
OUT="dist/deb"
ROOT="$OUT/root"
rm -rf "$OUT"
mkdir -p "$ROOT/DEBIAN" "$ROOT/usr/lib/deepseek-harness" "$ROOT/usr/bin" "$ROOT/usr/share/doc/deepseek-harness"

# Install bundle into /usr/lib/deepseek-harness
cp -a "$BUNDLE/." "$ROOT/usr/lib/deepseek-harness/"
chmod +x "$ROOT/usr/lib/deepseek-harness/dsh"
ln -sf /usr/lib/deepseek-harness/dsh "$ROOT/usr/bin/dsh"

cat > "$ROOT/DEBIAN/control" <<'CTLEOF'
Package: deepseek-harness
Version: VERSION_PLACEHOLDER
Section: utils
Priority: optional
Architecture: amd64
Maintainer: DeepSeek Harness <noreply@deepseek-ai.org>
Description: DeepSeek-native AI coding agent CLI with bundled Node runtime
 DeepSeek Harness (dsh) is a DeepSeek-native coding agent for your terminal.
 This package bundles its own Node.js runtime, so no system Node is required.
 The dsh command is installed to /usr/bin/dsh.
CTLEOF
sed -i "s/VERSION_PLACEHOLDER/$VERSION/" "$ROOT/DEBIAN/control"

cat > "$ROOT/usr/share/doc/deepseek-harness/README.txt" <<'RDEOF'
DeepSeek Harness (dsh) - packaged by the deepseek-harness fork.
Run `dsh --help` to get started. The web and headless profiles auto-initialize
on first use (DSH_HOME defaults to ~/.dsh).
RDEOF

dpkg-deb --build --root-owner-group "$ROOT" "$OUT/deepseek-harness_${VERSION}_amd64.deb"
echo "DONE: $(ls "$OUT"/deepseek-harness_*.deb)"
