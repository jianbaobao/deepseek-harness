/** The "统计" settings section: shows current session usage (rounds, tokens,
 * cache hit rate, cost estimate, model, workspace) from the host-side
 * `stats.describe` RPC. */
import { useEffect, useState, type ReactNode } from 'react'
import type { StatsLocaleKey } from './locales.ts'

/** Minimal stats surface (avoids a cross-package type import). */
export interface StatsApi {
  describe(request: { currentVersion?: string }): Promise<{
    result: { ok: true; value: StatsValue } | { ok: false }
  }>
}

export interface StatsValue {
  model?: string
  workspace?: string
  rounds: number
  tokens: { total: number; cacheRead?: number; uncachedInput?: number; output?: number }
  cacheHitRate?: number
  costEstimateCny?: number
}

/** Injected face: the host stats API plus the bound translator. */
export interface StatsPanelInjected {
  api: { stats: StatsApi }
  t: (key: StatsLocaleKey) => string
}

export type StatsPanelProps = StatsPanelInjected

type LoadState =
  | { status: 'loading' }
  | { status: 'ready'; value: StatsValue }
  | { status: 'error' }

function n(n: number | undefined): string {
  return typeof n === 'number' ? n.toLocaleString() : '—'
}

/** Render the statistics panel. */
export function StatsPanel({ api, t }: StatsPanelProps): ReactNode {
  const [state, setState] = useState<LoadState>({ status: 'loading' })

  const load = (): void => {
    setState({ status: 'loading' })
    void api.stats.describe({}).then(
      (response) => {
        if (!response.result.ok) { setState({ status: 'error' }); return }
        setState({ status: 'ready', value: response.result.value })
      },
      () => setState({ status: 'error' }),
    )
  }

  useEffect(load, [api])

  if (state.status === 'loading') return <div>{t('loading')}</div>
  if (state.status === 'error') return (
    <div>
      {t('error')} <button type="button" onClick={load}>{t('retry')}</button>
    </div>
  )

  const v = state.value
  const row = (label: string, value: string) => (
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, padding: '4px 0', borderBottom: '1px solid var(--dsw-alias-border-l1, #1c2027)' }}>
      <span>{label}</span><b>{value}</b>
    </div>
  )

  return (
    <div data-stats-panel>
      {row(t('model'), v.model || '—')}
      {row(t('workspace'), v.workspace || '—')}
      {row(t('rounds'), String(v.rounds))}
      {row(t('tokens'), n(v.tokens.total))}
      {row(t('hitRate'), v.cacheHitRate != null ? v.cacheHitRate + '%' : '—')}
      {row(t('cost'), v.costEstimateCny != null ? `¥${v.costEstimateCny}` : '—')}
      {row(t('cacheRead'), n(v.tokens.cacheRead))}
      {row(t('uncached'), n(v.tokens.uncachedInput))}
      {row(t('output'), n(v.tokens.output))}
    </div>
  )
}
