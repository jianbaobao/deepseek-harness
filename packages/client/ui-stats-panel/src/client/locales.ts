/** Copy dictionaries for the stats panel settings section. */

/** Simplified Chinese dictionary and key source of truth. */
export const zh = {
  nav: '统计',
  loading: '正在读取统计…',
  error: '无法读取统计。',
  retry: '重试',
  model: '模型',
  workspace: '工作区',
  rounds: '会话轮数',
  tokens: 'Tokens',
  hitRate: '缓存命中率',
  cost: '费用估算',
  total: '总计',
  cacheRead: '缓存命中',
  uncached: '未命中输入',
  output: '输出',
  empty: '暂无会话数据。',
}

/** English dictionary checked against the Chinese key set. */
export const en: Record<StatsLocaleKey, string> = {
  nav: 'Statistics',
  loading: 'Loading statistics…',
  error: 'Could not read statistics.',
  retry: 'Retry',
  model: 'Model',
  workspace: 'Workspace',
  rounds: 'Conversation rounds',
  tokens: 'Tokens',
  hitRate: 'Cache hit rate',
  cost: 'Estimated cost',
  total: 'Total',
  cacheRead: 'Cache read',
  uncached: 'Uncached input',
  output: 'Output',
  empty: 'No session data yet.',
}

/** Stats-panel locale key union. */
export type StatsLocaleKey = keyof typeof zh
