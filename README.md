# DeepSeek Harness Desktop（桌面版）

> 中文 AI 编程助手桌面客户端 —— 仿 Reasonix 界面布局，基于 [deepseek-ai/deepseek-harness](https://github.com/deepseek-ai/deepseek-harness) 生态开发。

一个开箱即用的桌面端：**项目列表 · 会话聊天 · 工具调用 · MCP 设置 · Skill 技能 · 插件扩展 · 应用设置**，全中文界面，支持 Windows / macOS / Linux 三大主流系统，并提供 exe / msi / dmg / AppImage / deb 安装包。

## ✨ 功能特性

| 功能 | 说明 |
| --- | --- |
| 📁 项目列表 | 打开 / 管理多个项目目录，记录最近使用，一键进入会话 |
| 💬 会话聊天 | 流式输出、思考过程折叠展示、Markdown 渲染、会话历史持久化 |
| 🛠 工具调用 | AI 自动调用命令 / 读写文件 / 搜索 / 抓取网页等工具，实时卡片展示参数与结果，敏感操作弹窗批准 |
| 🔌 MCP 设置 | 可视化添加、测试、启停 MCP stdio 服务器（文件系统、数据库、浏览器等），工具自动接入对话 |
| 📚 Skill 技能 | 内置中文示例技能，支持从 **zip 压缩包** 批量导入、启用/禁用、查看内容 |
| 🧩 插件 | JS 插件机制：注册自定义工具，支持 zip 安装，可扩展 AI 能力 |
| ⚙️ 设置 | DeepSeek API（Key / 模型 / 温度 / 系统提示词）、自动批准策略、主题字号、数据目录 |

## 📦 下载安装

前往 [Releases 页面](https://github.com/jianbaobao/deepseek-harness-desktop/releases) 下载对应系统的安装包：

| 系统 | 安装包 |
| --- | --- |
| Windows | `DeepSeek Harness Desktop-Setup-1.0.0-x64.exe`（NSIS 安装程序）、`.msi`（MSI）、`Portable .exe`（免安装版） |
| macOS | `DeepSeek Harness Desktop-1.0.0-arm64.dmg`（Apple Silicon）、`…-x64.dmg`（Intel） |
| Linux | `.AppImage`、`.deb` |
| 技能包 | `skills-pack.zip`（应用内「技能 → 导入技能包」安装） |

> Windows 首次运行如遇 SmartScreen 提示，点击「更多信息 → 仍要运行」即可。

## 🚀 快速上手

1. 启动应用，在「设置」中填入 **DeepSeek API Key**（[platform.deepseek.com](https://platform.deepseek.com) 申请）。
2. 在「项目」页点击「打开文件夹」，选择你的工作目录。
3. 进入会话，输入任务（例如：*帮我分析这个项目的结构，然后写一个单元测试*），AI 会调用工具逐步完成。
4. 可在「技能」页导入 `skills-pack.zip` 获得更多专业能力；在「MCP」页接入外部工具服务器；在「插件」页安装扩展。

## 🧩 Skill 技能格式

技能是带 frontmatter 的 Markdown 文件，放置于用户数据目录 `skills/`：

`BTQ`markdown
---
name: 代码审查
description: 对项目代码进行系统性审查
version: 1.0.0
language: zh-CN
---

# 代码审查

（技能正文：指导 AI 如何执行该技能）
`BTQ`

将多个技能文件打包为 zip（根目录含 `skills/` 或不含均可），即可在应用内批量导入。`release/skills-pack.zip` 为内置示例技能包。

## 🔌 MCP 配置

MCP（Model Context Protocol）用于接入外部工具。示例（文件系统服务器）：

- **名称**：文件系统
- **命令**：`npx -y @modelcontextprotocol/server-filesystem D:\work`

支持 stdio 类型服务器；添加后可「测试连接」，成功后会将其工具自动注入会话供 AI 调用（工具名以 `mcp__` 开头）。

## 🧩 插件开发

每个插件是一个包含 `plugin.json` 的文件夹，入口 JS 导出 `activate(ctx)`：

`BTQ`js
module.exports = {
  activate(ctx) {
    ctx.registerTool({ name: 'my_tool', description: '…', parameters: { type: 'object', properties: {} } }, (args) => {
      return { ok: true, result: '…' };
    });
  }
};
`BTQ`

打包为 zip（根目录为插件名）后，在「插件」页安装。参考 `examples/hello-plugin`。

## 🛠 本地开发

`BTQ`bash
git clone https://github.com/jianbaobao/deepseek-harness-desktop.git
cd deepseek-harness-desktop
npm install
npm run icon          # 生成应用图标
npm run start         # 启动开发
npm run dist:win      # 打包 Windows（nsis/msi/portable）
npm run dist:mac      # 打包 macOS dmg（需在 macOS 上执行）
npm run dist:linux    # 打包 Linux（AppImage/deb，需在 Linux 上执行）
npm run skills:zip    # 生成技能包 zip
`BTQ`

## 📁 目录结构

`BTQ`
deepseek-harness-desktop/
├── src/main/          # Electron 主进程（存储/Agent/MCP/Skill/插件/IPC）
├── src/preload.js     # 安全桥接层
├── renderer/          # 前端界面（无构建依赖，原生 ESM）
│   ├── views/         # 项目/会话/技能/MCP/插件/设置 六个视图
│   └── lib/           # markdown 渲染 / 图标 / UI 工具
├── resources/skills-bundle/  # 内置示例技能
├── examples/          # 示例插件
├── scripts/           # 图标生成 / zip 打包工具
└── .github/workflows/ # 三平台自动构建发布
`BTQ`

## 🔒 数据与隐私

- 应用数据保存在用户数据目录（Windows：`%APPDATA%\DeepSeek Harness Desktop`；macOS：`~/Library/Application Support/…`；Linux：`~/.config/…`）。
- API Key 仅保存在本机 `settings.json`，不会上传。
- 文件工具默认只能在当前项目目录内读写。

## 📄 许可

MIT License。本项目是独立的桌面客户端实现，致敬并借鉴了 [DeepSeek-Reasonix](https://github.com/esengine/DeepSeek-Reasonix) 的界面布局与 [deepseek-ai/deepseek-harness](https://github.com/deepseek-ai/deepseek-harness) 的设计理念。
