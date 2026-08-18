import { useEffect, useId, useMemo, useState, type ReactNode } from 'react'
import type { PluginInventorySnapshot } from '@deepseek-ai/dsh-api-remotes/client'
import {
  IconChevronDownOutline14,
  IconSearchOutline16,
} from '@deepseek-ai/dsh-client-ui-primitives'
import type { InjectFace, PropsLocale, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
import type { PluginInventoryLocaleKey } from './locales.ts'
import css from './PluginInventorySettingsTab.module.css'

/** Registration-side Remote face used by the section. */
export interface PluginInventorySettingsTabInjected {
  /** Read a current Host inventory snapshot. */
  list: () => Promise<PluginInventorySnapshot>
}

type PluginInventoryEntry = PluginInventorySnapshot['entries'][number]
type PluginFiberPhase = PluginInventoryEntry['fiberPhase']

/** Full component props assembled by the Settings slot renderer. */
export type PluginInventorySettingsTabProps =
  PropsRuntime<'settings.plugins.tab'>
  & PropsLocale<'settings.pluginInventory'>
  & InjectFace<PluginInventorySettingsTabInjected>

type ViewState =
  | { readonly status: 'loading' }
  | { readonly status: 'error' }
  | { readonly status: 'ready'; readonly snapshot: PluginInventorySnapshot }

const PHASE_KEYS = {
  pending: 'pending',
  loading: 'loadingPhase',
  active: 'active',
  failed: 'failed',
  unloading: 'unloading',
} satisfies Record<Exclude<PluginFiberPhase, null>, PluginInventoryLocaleKey>

/** Localized accessible label for one root Fiber phase. */
function phaseLabel(
  phase: PluginFiberPhase,
  t: PluginInventorySettingsTabProps['t'],
): string {
  return phase === null ? t('unobserved') : t(PHASE_KEYS[phase])
}

/** Compact a module specifier without guessing whether its Loader id was generated. */
/**
 * Simplified-Chinese display names for plugin modules (semantic mapping of the
 * scoped package name). Unknown modules fall back to the English short name.
 */
const ZH_PLUGIN_NAMES: Record<string, string> = {
  'cordis': 'Cordis 核心框架',
  'cordis-plugin-hmr': '热模块替换',
  'cordis-plugin-include': '配置包含',
  'cordis-plugin-loader': '插件加载器',
  'cordis-plugin-timer': '定时器',
  'cordis-plugin-logger-console': '控制台日志',
  'dsh': '主程序',
  'dsh-acp': 'ACP 协议桥接',
  'dsh-agent': '智能体核心',
  'dsh-agent-default-model': '默认模型',
  'dsh-agent-instructions': '系统指令',
  'dsh-agent-loop': '智能体循环',
  'dsh-agent-presets': '智能体预设',
  'dsh-agent-tool-presentation': '工具呈现',
  'dsh-anonymous-user-id': '匿名标识',
  'dsh-api-gateway': 'API 网关',
  'dsh-api-remotes': 'API 远程服务',
  'dsh-app-boot': '应用启动',
  'dsh-atomic-write': '原子写入',
  'dsh-attachment': '附件服务',
  'dsh-attachment-local': '本地附件',
  'dsh-base': '基础层',
  'dsh-bash-local': '本地 Bash',
  'dsh-bash-sandbox': 'Bash 沙箱',
  'dsh-brand': '品牌资源',
  'dsh-client-connection': '客户端连接',
  'dsh-client-hmr': '前端热更新',
  'dsh-client-locale': '界面语言',
  'dsh-client-modules': '客户端模块',
  'dsh-client-runtime': '客户端运行时',
  'dsh-client-schema-form': '表单渲染',
  'dsh-client-ui-agent-preset': '智能体预设界面',
  'dsh-client-ui-attachment': '附件界面',
  'dsh-client-ui-commands': '命令界面',
  'dsh-client-ui-conversation': '对话界面',
  'dsh-client-ui-cordis': '插件管理界面',
  'dsh-client-ui-deliverables': '交付物界面',
  'dsh-client-ui-directory-picker-browse': '目录浏览选择器',
  'dsh-client-ui-directory-picker-native': '系统目录选择器',
  'dsh-client-ui-goal': '目标界面',
  'dsh-client-ui-input-trigger': '输入触发',
  'dsh-client-ui-jobs': '任务界面',
  'dsh-client-ui-layout': '布局框架',
  'dsh-client-ui-message-feedback': '消息反馈界面',
  'dsh-client-ui-model-selection': '模型选择界面',
  'dsh-client-ui-permission-presets': '权限预设界面',
  'dsh-client-ui-plan': '规划模式界面',
  'dsh-client-ui-primitives': '基础组件库',
  'dsh-client-ui-settings': '设置界面',
  'dsh-client-ui-settings-general': '通用设置',
  'dsh-client-ui-settings-models': '模型设置',
  'dsh-client-ui-settings-plugin-inventory': '插件清单设置',
  'dsh-client-ui-settings-plugins': '插件设置',
  'dsh-client-ui-sidebar': '侧边栏',
  'dsh-client-ui-skill': '技能界面',
  'dsh-client-ui-slots': '插槽系统',
  'dsh-client-ui-subagent': '子智能体界面',
  'dsh-client-ui-theme': '主题界面',
  'dsh-client-ui-tool': '工具界面',
  'dsh-client-ui-trajectory': '轨迹界面',
  'dsh-client-ui-user-questions': '用户提问界面',
  'dsh-client-ui-workflow-run': '流程运行界面',
  'dsh-client-ui-workspace': '工作区界面',
  'dsh-client-web': 'Web 客户端',
  'dsh-client-web-react': 'React 渲染层',
  'dsh-cmdline': '命令行解析',
  'dsh-code-runtime': '代码运行',
  'dsh-code-runtime-worker-thread': '代码运行工作线程',
  'dsh-command-compact': '压缩命令',
  'dsh-command-feedback': '反馈命令',
  'dsh-command-goal': '目标命令',
  'dsh-commands': '命令中心',
  'dsh-compaction': '会话压缩',
  'dsh-compaction-basic': '基础压缩',
  'dsh-compaction-tool-result-pruner': '工具结果裁剪',
  'dsh-cordis-client-runner': '客户端运行器',
  'dsh-cordis-host-runner': '宿主运行器',
  'dsh-credentials': '凭据管理',
  'dsh-credentials-local': '本地凭据',
  'dsh-e2b': 'E2B 沙箱',
  'dsh-fs': '文件系统',
  'dsh-fs-local': '本地文件系统',
  'dsh-fs-observation-policy': '文件观察策略',
  'dsh-fs-sandbox': '文件沙箱',
  'dsh-goal': '目标服务',
  'dsh-goal-round-driver': '目标轮次驱动',
  'dsh-headless': '无头模式',
  'dsh-home-paths': '主目录路径',
  'dsh-hook-protocol': '钩子协议',
  'dsh-hooks-claude-code': 'Claude Code 钩子',
  'dsh-hooks-codex': 'Codex 钩子',
  'dsh-host-apiproxy': 'API 代理',
  'dsh-host-directory-picker-native': '系统目录选择器',
  'dsh-host-frontend-static': '前端静态资源',
  'dsh-host-plugin-inventory': '插件清单服务',
  'dsh-host-webserver': 'Web 服务器',
  'dsh-invariants': '运行时诊断',
  'dsh-jobs': '任务服务',
  'dsh-jobs-local': '本地任务',
  'dsh-launch-environment': '启动环境',
  'dsh-llm': '大模型服务',
  'dsh-llm-deepseek': 'DeepSeek 模型',
  'dsh-llm-pi-ai': 'Pi AI 模型',
  'dsh-llm-retry': '重试策略',
  'dsh-lsp': 'LSP 语言服务',
  'dsh-lsp-stdio': 'LSP 标准输入输出',
  'dsh-mcp-client': 'MCP 客户端',
  'dsh-permission-presets': '权限预设',
  'dsh-persona': '角色配置',
  'dsh-plan-mode': '规划模式',
  'dsh-pwsh-local': '本地 PowerShell',
  'dsh-pwsh-sandbox': 'PowerShell 沙箱',
  'dsh-sandbox': '沙箱服务',
  'dsh-sandbox-local': '本地沙箱',
  'dsh-sandbox-policy': '沙箱策略',
  'dsh-sandbox-windows-acl': 'Windows ACL 沙箱',
  'dsh-schedule': '任务调度',
  'dsh-scope': '作用域',
  'dsh-sdk-server': 'SDK 服务器',
  'dsh-session': '会话服务',
  'dsh-session-checkpoint-policy': '会话检查点',
  'dsh-session-log-export': '会话日志导出',
  'dsh-session-persistence': '会话持久化',
  'dsh-session-persistence-jsonl': 'JSONL 会话存储',
  'dsh-session-persistence-sqlite': 'SQLite 会话存储',
  'dsh-session-projection': '会话投影',
  'dsh-session-query': '会话检索',
  'dsh-session-query-sqlite': 'SQLite 会话检索',
  'dsh-session-reference': '会话引用',
  'dsh-session-stats': '会话统计',
  'dsh-session-telemetry': '会话遥测',
  'dsh-session-title': '会话标题',
  'dsh-settings': '设置服务',
  'dsh-settings-file': '配置文件',
  'dsh-shell': '终端服务',
  'dsh-shell-env': '终端环境',
  'dsh-skill': '技能系统',
  'dsh-skill-badge': '技能徽章',
  'dsh-skill-filesystem': '技能文件系统',
  'dsh-spill': '外溢存储',
  'dsh-storage': '存储服务',
  'dsh-storage-json': 'JSON 存储',
  'dsh-storage-sqlite': 'SQLite 存储',
  'dsh-subagent': '子智能体',
  'dsh-subagent-acp': 'ACP 子智能体',
  'dsh-subagent-claude-code': 'Claude Code 子智能体',
  'dsh-subagent-codex': 'Codex 子智能体',
  'dsh-subprocess': '子进程',
  'dsh-subprocess-local': '本地子进程',
  'dsh-system-prompt': '系统提示词',
  'dsh-terminal': '终端',
  'dsh-terminal-bash': 'Bash 终端',
  'dsh-time-context': '时间上下文',
  'dsh-tmux-context': 'tmux 上下文',
  'dsh-token-meter': 'Token 计量',
  'dsh-tool-ask-user': '询问用户工具',
  'dsh-tool-bash': 'Bash 工具',
  'dsh-tool-bash-persistent': '持久化 Bash 工具',
  'dsh-tool-fs': '文件工具',
  'dsh-tool-fs-search': '文件搜索工具',
  'dsh-tool-goal': '目标工具',
  'dsh-tool-jobs': '任务工具',
  'dsh-tool-lsp': 'LSP 工具',
  'dsh-tool-pwsh': 'PowerShell 工具',
  'dsh-tool-ralph': 'Ralph 流程工具',
  'dsh-tool-session-query': '会话检索工具',
  'dsh-tool-skill': '技能工具',
  'dsh-tool-subagent': '子智能体工具',
  'dsh-tool-subagent-control': '子智能体控制工具',
  'dsh-tool-todo': '待办工具',
  'dsh-tool-web': '网页工具',
  'dsh-tool-workflow': '流程工具',
  'dsh-tools': '工具注册中心',
  'dsh-user-approval': '用户审批',
  'dsh-user-questions': '用户提问',
  'dsh-web': 'Web 服务',
  'dsh-web-app': 'Web 界面应用',
  'dsh-web-fetch-http': 'HTTP 抓取',
  'dsh-web-frontend': 'Web 前端',
  'dsh-web-search-deepseek': 'DeepSeek 搜索',
  'dsh-web-search-exa': 'Exa 搜索',
  'dsh-web-search-perplexity': 'Perplexity 搜索',
  'dsh-workflow': '流程引擎',
  'dsh-workflow-worker-thread': '流程工作线程',
  'dsh-workspace': '工作区',
}

function moduleShortName(moduleName: string): string {
  const unscoped = moduleName.startsWith('@') ? moduleName.slice(moduleName.indexOf('/') + 1) : moduleName
  return (ZH_PLUGIN_NAMES[unscoped] === undefined)
    ? unscoped
      .replace(/^cordis:/, '')
      .replace(/^cordis-plugin-/, '')
      .replace(/^dsh-(?:host-|client-)?/, '')
    : ZH_PLUGIN_NAMES[unscoped]
}

/** Whether an inventory row matches the local catalog query. */
function matches(entry: PluginInventoryEntry, normalizedQuery: string): boolean {
  if (normalizedQuery.length === 0) return true
  return [entry.moduleName, entry.entryId]
    .some(value => value.toLocaleLowerCase().includes(normalizedQuery))
}

/** Render the read-only current Loader inventory. */
export function PluginInventorySettingsTab({ list, t }: PluginInventorySettingsTabProps): ReactNode {
  const catalogId = useId()
  const [request, setRequest] = useState(0)
  const [query, setQuery] = useState('')
  const [expanded, setExpanded] = useState<PluginInventoryEntry['entryId'] | null>(null)
  const [state, setState] = useState<ViewState>({ status: 'loading' })

  useEffect(() => {
    let current = true
    void Promise.resolve().then(() => list()).then(
      (snapshot) => { if (current) setState({ status: 'ready', snapshot }) },
      () => { if (current) setState({ status: 'error' }) },
    )
    return () => { current = false }
  }, [list, request])

  const normalizedQuery = query.trim().toLocaleLowerCase()
  const filteredEntries = useMemo(
    () => state.status === 'ready'
      ? state.snapshot.entries.filter(entry => matches(entry, normalizedQuery))
      : [],
    [normalizedQuery, state],
  )

  useEffect(() => {
    if (expanded !== null && !filteredEntries.some(entry => entry.entryId === expanded)) {
      setExpanded(null)
    }
  }, [expanded, filteredEntries])

  const retry = (): void => {
    setState({ status: 'loading' })
    setRequest(value => value + 1)
  }

  return (
    <div className={css.section} aria-busy={state.status === 'loading'}>
      {state.status === 'loading' ? <p className={css.status}>{t('loading')}</p> : null}
      {state.status === 'error' ? (
        <div className={css.failure}>
          <p role="alert">{t('error')}</p>
          <button type="button" onClick={retry}>{t('retry')}</button>
        </div>
      ) : null}
      {state.status === 'ready' ? (
        <div className={css.catalog}>
          <label className={css.search}>
            <IconSearchOutline16 aria-hidden="true" />
            <span className={css.visuallyHidden}>{t('search')}</span>
            <input
              type="search"
              value={query}
              placeholder={t('search')}
              aria-label={t('search')}
              onChange={(event) => { setQuery(event.currentTarget.value) }}
            />
          </label>
          <div className={css.catalogHeading}>
            <h3>{t('catalog')}</h3>
            <span data-plugin-count={filteredEntries.length}>{filteredEntries.length}</span>
          </div>
          {state.snapshot.entries.length === 0 ? <p className={css.status}>{t('empty')}</p> : null}
          {state.snapshot.entries.length > 0 && filteredEntries.length === 0
            ? <p className={css.status}>{t('emptySearch')}</p>
            : null}
          {filteredEntries.length > 0 ? (
            <ul className={css.cards}>
              {filteredEntries.map((entry) => {
                const status = phaseLabel(entry.fiberPhase, t)
                const title = moduleShortName(entry.moduleName)
                const configuration = t(entry.enabled ? 'enabledTag' : 'disabledTag')
                const open = expanded === entry.entryId
                const detailId = `${catalogId}-details-${encodeURIComponent(entry.entryId)}`
                return (
                  <li
                    className={css.card}
                    key={entry.entryId}
                    data-plugin-entry={entry.entryId}
                    data-open={open ? 'true' : undefined}
                  >
                    <button
                      className={css.cardContent}
                      type="button"
                      aria-expanded={open}
                      aria-controls={detailId}
                      aria-label={entry.enabled ? `${title}, ${status}, ${configuration}` : `${title}, ${configuration}`}
                      onClick={() => {
                        setExpanded(current => current === entry.entryId ? null : entry.entryId)
                      }}
                    >
                      <strong className={css.cardTitle} title={entry.moduleName}>{title}</strong>
                      <span className={css.cardTrailing}>
                        {entry.enabled ? (
                          <span
                            className={css.statusDot}
                            data-phase={entry.fiberPhase ?? 'unobserved'}
                            role="img"
                            aria-label={status}
                            title={status}
                          />
                        ) : null}
                        <span className={css.configTag} data-enabled={entry.enabled ? 'true' : 'false'}>
                          {configuration}
                        </span>
                        <IconChevronDownOutline14 className={css.chevron} size={12} aria-hidden="true" />
                      </span>
                    </button>
                    {open ? (
                      <div className={css.cardDetails} id={detailId}>
                        <code className={css.entryValue} data-loader-entry>{entry.entryId}</code>
                        <dl className={css.details}>
                          <div>
                            <dt>{t('configuration')}</dt>
                            <dd>{configuration}</dd>
                          </div>
                          {entry.enabled ? (
                            <div>
                              <dt>{t('cordis')}</dt>
                              <dd>{status}</dd>
                            </div>
                          ) : null}
                        </dl>
                      </div>
                    ) : null}
                  </li>
                )
              })}
            </ul>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}
