# 发布指南（Release Guide）

本仓库通过 GitHub Actions 自动构建并发布安装包到本仓库的 **Releases** 页面，
发布形态参考 [esengine/DeepSeek-Reasonix](https://github.com/esengine/DeepSeek-Reasonix)。

## 产物（Release Assets）

| 产物 | 说明 |
|---|---|
| `dsh-windows-x64-<version>.zip` | Windows 便携包：解压后运行 `dsh.cmd`（需要 Node.js >= 22.19） |
| `dsh-npm-packages-<version>.zip` | 全部 `@deepseek-ai/*` 包的 npm tarball 合集（约 230 个 .tgz），解压后可 `npm i -g` 安装 |
| `SHA256SUMS` | 所有产物的 SHA-256 校验和 |
| `latest.json` | 最新版本信息（供更新检查） |

## 触发发布

推送一个版本 tag 即可（tag 名形如 `dsh-v0.1.0-rc.5` 或 `v0.1.0-rc.5`）：

```bash
git tag dsh-v0.1.0-rc.5
git push origin dsh-v0.1.0-rc.5
```

推送后 `Build & Release Installers` workflow 会自动运行：

1. **Pack npm tarballs**（ubuntu）：`pnpm install` → `pnpm run build` → 打包 dsh + vendor 全部 npm tarball；
2. **Build Windows portable package**（windows）：构建 → 组装便携目录（全部依赖固定为本仓库源码版本）→ 压缩为 zip；
3. **Publish GitHub Release**：创建 Release 并上传所有产物。

也可以不带 tag 手动触发（Actions → Build & Release Installers → Run workflow），
版本号取自 `apps/cli/package.json`，Release tag 自动创建为 `dsh-v<version>`。

## 本地验证

```bash
pnpm install --frozen-lockfile
pnpm run build
bash scripts/pack-all-tgz.sh dist/tgz          # 生成 npm tarballs
node scripts/package-portable.mjs . dist/portable   # 组装便携目录
```

## Windows 使用说明

1. 下载 `dsh-windows-x64-<version>.zip` 并解压；
2. 安装 [Node.js](https://nodejs.org) >= 22.19；
3. 在解压目录运行 `dsh.cmd`（或 `node node_modules/@deepseek-ai/dsh/lib/bin.js`）；
4. `dsh --profile web` 启动 web 界面，`dsh --profile headless "任务"` 无头执行。
