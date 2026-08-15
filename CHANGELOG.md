# Changelog

本项目每次发布都会把对应版本的更新内容写入 GitHub Release 说明。
格式：`## <版本> (日期)` 开始的段落。

## 0.1.0-rc.7 (2026-08-15)
- 优化桌面版启动速度：窗口立即打开并显示加载页，不再等待后端就绪
- 修复远程 master 分支被误删导致的推送问题（重建 master + 修正 origin/HEAD）

## 0.1.0-rc.6 (2026-08-15)
- 新增：自定义工作区地址（`%APPDATA%\dsh-desktop\settings.json` 的 `workspace` 字段，或环境变量 `DSH_DESKTOP_WORKSPACE`）
- 修复：桌面版关闭窗口时前后端进程不同步（改为进程树终止 `taskkill /T`）
- 优化：后端 node 运行时窗口隐藏（`windowsHide`，不再弹出控制台）
- 优化：安装器「创建桌面快捷方式」默认勾选

## 0.1.0-rc.5 (2026-08-13)
- 首个自动构建发布：全平台安装包（Windows 安装器/便携包、Linux deb、macOS dmg）
- 桌面版（Electron，Reasonix 风格窗口）首次发布
- `dsh` 无参数启动自动进入 Web 界面
- 修复 e2e 缺 key 假失败、CI 自托管 runner 挂起、Windows 发布脚本兼容等 fork 适配问题

## 0.1.0-rc.8 (2026-08-15)
- 新增：工作区目录选择器默认定位到用户主目录（不再固定在"文档"文件夹，可自由导航任意位置）
- 新增：Release 发行说明自动写入本次更新内容（来自 CHANGELOG.md）
- 密钥本地存储：模型 API 密钥在 设置 → 模型 中填写后保存到 `~/.dsh/settings.yaml`（桌面版为 `%APPDATA%\dsh-desktop\dsh-home\settings.yaml`），本地存储不上传

## 0.1.0-rc.9 (2026-08-15)
- 新增：桌面版在线更新检查（OTA）——启动后自动检测新版本，弹窗提示前往下载
- 新增：桌面版截图功能（Ctrl+Shift+S 全屏截图，保存到图片目录并复制到剪贴板，可配合视觉模型识别内容）
- 优化：性能——升级检查与截图均为后台/按需，不阻塞启动

## 0.1.0-rc.10 (2026-08-15)
- 新增：桌面版统计面板（Ctrl+Shift+D）——显示版本、工作区、DeepSeek 账户余额（需先配置 API Key）
- 会话 tokens / 命中率 / 费用 / 速度等实时统计：数据接口开发中（下个版本接入）

## 0.1.0-rc.11 (2026-08-15)
- 新增：会话统计 RPC（stats.describe）——聚合当前会话的模型、工作区、轮数、tokens
- 升级：桌面版统计面板（Ctrl+Shift+D）——Reasonix 风格条显示模型/工作区/余额/轮数/Tokens
