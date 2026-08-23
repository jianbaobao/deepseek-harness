/** Copy dictionaries for the settings update row. */

/** Simplified Chinese dictionary and key source of truth. */
export const zh = {
  label: '升级',
  hint: '检查 DeepSeek Harness 是否有新版本',
  current: '当前版本',
  latest: '最新版本',
  check: '检查更新',
  checking: '检查中…',
  upToDate: '已是最新版本',
  updateAvailable: '发现新版本',
  goDownload: '前往下载',
  failed: '检查更新失败',
}

/** English dictionary checked against the Chinese key set. */
export const en: Record<UpdateLocaleKey, string> = {
  label: 'Upgrade',
  hint: 'Check for a newer DeepSeek Harness release',
  current: 'Current version',
  latest: 'Latest version',
  check: 'Check for updates',
  checking: 'Checking…',
  upToDate: 'You are up to date',
  updateAvailable: 'A new version is available',
  goDownload: 'Go to downloads',
  failed: 'Update check failed',
}

/** Update-row locale key union. */
export type UpdateLocaleKey = keyof typeof zh
