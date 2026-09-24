# DeepSeek Harness Desktop v1.0.0

中文 AI 编程助手桌面客户端（仿 Reasonix 界面布局），基于 deepseek-harness 生态开发。

## 安装包

- **Windows**
  - \`DeepSeek Harness Desktop-Setup-1.0.0-x64.exe\` —— NSIS 安装程序
  - \`DeepSeek Harness Desktop-1.0.0-x64.msi\` —— MSI 安装程序
  - \`DeepSeek Harness Desktop-Portable-1.0.0-x64.exe\` —— 免安装便携版
- **macOS**
  - \`DeepSeek Harness Desktop-1.0.0-arm64.dmg\`（Apple Silicon）
  - \`DeepSeek Harness Desktop-1.0.0-x64.dmg\`（Intel）
- **Linux**
  - \`.AppImage\` / \`.deb\`
- **技能包** \`skills-pack.zip\` —— 应用内「技能 → 导入技能包」安装（含 6 个中文示例技能）

## 功能

- 项目列表：多项目管理、最近使用、一键进入会话
- 会话聊天：流式输出、思考过程折叠、Markdown 渲染、历史持久化
- 工具调用：命令/文件/搜索/网页抓取，实时卡片展示，敏感操作批准
- MCP 设置：stdio 服务器可视化配置、测试、启停，工具自动接入
- Skill 技能：zip 导入、启用/禁用、查看内容
- 插件：JS 插件扩展（示例见 examples/hello-plugin）
- 设置：API Key / 模型 / 温度 / 系统提示词 / 自动批准策略 / 主题 / 字号

## 快速开始

1. 启动应用 → 「设置」填入 DeepSeek API Key
2. 「项目」→ 打开文件夹
3. 输入任务开始对话
