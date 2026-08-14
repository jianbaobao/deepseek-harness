#!/usr/bin/env bash
# Build a macOS .dmg from a portable bundle (with bundled Node runtime).
# The dmg contains the dsh CLI folder plus a double-clickable 安装.command
# that links dsh into ~/.local/bin (no sudo needed).
# Usage: bash scripts/package-dmg.sh <version> [bundle-dir]
#   bundle-dir default: dist/macos-bundle  (layout: node/, node_modules/, dsh, README.txt)
set -euo pipefail
REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO"
VERSION="${1:?usage: package-dmg.sh <version> [bundle-dir]}"
BUNDLE="${2:-dist/macos-bundle}"
OUT="dist/dmg"
STAGE="$OUT/stage"
rm -rf "$OUT"
mkdir -p "$STAGE/DeepSeek Harness"

cp -a "$BUNDLE/." "$STAGE/DeepSeek Harness/"
chmod +x "$STAGE/DeepSeek Harness/dsh"

cat > "$STAGE/安装.command" <<'INSTEOF'
#!/usr/bin/env bash
# DeepSeek Harness installer: links dsh into ~/.local/bin (no sudo required).
set -e
DIR="$(cd "$(dirname "$0")" && pwd)"
APP="$DIR/DeepSeek Harness"
DEST="$HOME/.local/share/deepseek-harness"
BINDIR="$HOME/.local/bin"

mkdir -p "$DEST" "$BINDIR"
cp -R "$APP/." "$DEST/"
ln -sf "$DEST/dsh" "$BINDIR/dsh"

echo ""
echo "DeepSeek Harness 已安装到:"
echo "  $DEST"
echo ""
echo "已创建软链接: $BINDIR/dsh"
echo ""
if [[ ":$PATH:" != *":$BINDIR:"* ]]; then
  echo "提示: $BINDIR 不在 PATH 中，请执行以下命令添加："
  echo "  export PATH=\"$BINDIR:\$PATH\""
  echo "（建议写入 ~/.zshrc）"
fi
echo ""
echo "现在可以运行: dsh --help"
echo ""
read -r -p "按回车键关闭..." _
INSTEOF
chmod +x "$STAGE/安装.command"

cat > "$STAGE/README.txt" <<'RDEOF'
DeepSeek Harness (dsh) for macOS
================================

内容:
  DeepSeek Harness/   完整的 dsh CLI（含捆绑的 Node.js runtime，无需系统 Node）
  安装.command        双击运行，把 dsh 链接到 ~/.local/bin

安装:
  1. 双击 安装.command（首次运行需在 系统设置 -> 隐私与安全性 中允许）
  2. 完成后终端执行: dsh --help

卸载:
  rm -rf ~/.local/share/deepseek-harness ~/.local/bin/dsh
RDEOF

hdiutil create -volname "DeepSeek Harness" -srcfolder "$STAGE" \
  -ov -format UDZO "$OUT/DeepSeek-Harness-${VERSION}-macos.dmg"
echo "DONE: $(ls "$OUT"/DeepSeek-Harness-*.dmg)"
