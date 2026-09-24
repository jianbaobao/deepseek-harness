'use strict';
// 示例插件：展示插件 API 用法
// 插件结构：目录内包含 plugin.json 与入口 js，打包成 zip 后可在应用内「插件 → 安装插件包」安装
module.exports = {
  activate(ctx) {
    ctx.log('Hello 插件已激活');

    ctx.registerTool(
      {
        name: 'get_time',
        description: '获取当前日期时间（示例插件提供）',
        parameters: {
          type: 'object',
          properties: {
            format: { type: 'string', description: '可选：full / date / time' }
          }
        }
      },
      (args) => {
        const now = new Date();
        const fmt = args.format || 'full';
        const iso = now.toISOString();
        const cn = now.toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' });
        if (fmt === 'date') return { ok: true, result: iso.slice(0, 10) };
        if (fmt === 'time') return { ok: true, result: iso.slice(11, 19) };
        return { ok: true, result: cn, iso };
      }
    );

    ctx.registerTool(
      {
        name: 'greet',
        description: '输出一句问候语（示例插件提供）',
        parameters: { type: 'object', properties: { who: { type: 'string' } } }
      },
      (args) => ({ ok: true, result: '你好，' + (args.who || '世界') + '！我是 DeepSeek Harness 的示例插件。' })
    );
  },
  deactivate() {
    console.log('Hello 插件已停用');
  }
};
