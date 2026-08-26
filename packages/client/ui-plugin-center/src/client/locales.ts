/** Copy dictionaries for the plugin center settings section. */

/** Simplified Chinese dictionary and key source of truth. */
export const zh = {
  nav: '插件中心',
  loading: '正在加载插件…',
  error: '无法获取插件列表。',
  retry: '重试',
  mirrorOn: '镜像加速已开启',
  mirrorOff: '镜像加速已关闭',
  auditOn: '安全审计已开启',
  auditOff: '安全审计已关闭',
  fork: 'fork 分叉',
  archived: '已归档',
  newRepo: '新仓库',
  official: '官方/活跃',
  copy: '复制',
  copied: '已复制',
  clone: 'git clone',
  updated: '更新',
  empty: '未获取到插件列表',
}

/** English dictionary checked against the Chinese key set. */
export const en: Record<PluginLocaleKey, string> = {
  nav: 'Plugin Center',
  loading: 'Loading plugins…',
  error: 'Could not fetch plugins.',
  retry: 'Retry',
  mirrorOn: 'Mirror acceleration on',
  mirrorOff: 'Mirror acceleration off',
  auditOn: 'Security audit on',
  auditOff: 'Security audit off',
  fork: 'fork',
  archived: 'archived',
  newRepo: 'new repo',
  official: 'official / active',
  copy: 'Copy',
  copied: 'Copied',
  clone: 'git clone',
  updated: 'Updated',
  empty: 'No plugins found',
}

/** Plugin-center locale key union. */
export type PluginLocaleKey = keyof typeof zh
