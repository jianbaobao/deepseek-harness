---
name: Git 提交规范
description: 按照约定式提交规范编写清晰的 Git 提交信息。
version: 1.0.0
language: zh-CN
---
# Git 提交规范

按约定式提交（Conventional Commits）编写：

- 格式：`<type>(<scope>): <subject>`
- type 包括 feat / fix / docs / style / refactor / perf / test / chore / revert
- subject 用简洁的中文祈使句，不超过 50 字
- 需要时在正文说明原因，并以 issue 编号结尾（若有）

示例：
\`\`\`
feat(mcp): 支持从 zip 批量导入 MCP 服务器配置
\`\`\`