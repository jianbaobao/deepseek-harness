# 发布指南（Release Guide）

本仓库通过 GitHub Actions 自动构建并发布安装包到本仓库的 **Releases** 页面，
发布形态参考 [esengine/DeepSeek-Reasonix](https://github.com/esengine/DeepSeek-Reasonix)。

## 产物（Release Assets）

| 产物 | 说明 |
|---|---|
| `DeepSeek-Harness-<version>-setup.exe` | Windows 安装器（Inno Setup，免安装 Node，装到开始菜单/PATH） |
| `deepseek-harness_<version>_amd64.deb` | Debian/Ubuntu 安装包（`sudo dpkg -i`，捆绑 Node） |
| `DeepSeek-Harness-<version>-macos.dmg` | macOS 磁盘映像（运行 `安装.command` 链接到 ~/.local/bin，捆绑 Node） |
| `dsh-windows-x64-<version>.zip` | Windows 便携版：解压后运行 `dsh.cmd`（捆绑 Node） |
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

## Web 界面使用指南

`dsh` 无参数启动即打开 Web 对话界面（默认 http://127.0.0.1:3080）。

### 界面功能

| 功能 | 入口 | 说明 |
|---|---|---|
| 项目/工作区 | 侧栏「工作区」 | 浏览与切换目录、文件树，会话绑定到指定目录 |
| 新会话 | 侧栏「新会话」 | 开始新对话 |
| 设置 | 设置面板 | 模型/API 配置、界面偏好、插件清单 |
| 模型选择 | 对话输入区 | 切换当前模型 |
| Skill/插件 | 设置 → 插件 / 对话工具 | 内置技能自动挂载，可管理插件 |
| 工具调用 | 对话中自动触发 | bash / 文件 / 任务 / 搜索等 |
| 目标与规划 | 对话工具栏 | goal / plan 模式 |

### 配置 MCP 服务器

编辑（不存在则创建）`~/.dsh/profiles/web/cordis.patch.yml`（Windows 为 `%USERPROFILE%\.dsh\profiles\web\cordis.patch.yml`），追加服务器实例：

```yaml
# stdio 型（本地命令）
- id: mcp-github
  name: '@deepseek-ai/dsh-mcp-client'
  config:
    serverName: github
    transport: stdio
    command: npx
    args: ['-y', '@modelcontextprotocol/server-github']
    env:
      GITHUB_TOKEN: !!js process.env.GITHUB_TOKEN

# HTTP 型（远程服务）
- id: mcp-web
  name: '@deepseek-ai/dsh-mcp-client'
  config:
    serverName: web
    transport: streamable-http
    url: http://localhost:3000/mcp
```

保存后 HMR 自动热加载（无需重启），模型即可调用 `mcp__<serverName>__<工具名>` 工具。
常用配置：`command/args/env/cwd`（stdio）、`url/headers`（HTTP）、`toolCallTimeoutMs`（默认 60000）、`reconnect.*`（断线重连，默认开启）。
