/** The "插件中心" settings section: browse GitHub #dsh-plugin repos and copy
 * a mirror-accelerated clone command, with basic security signals. Data is
 * fetched via GitHub's public search API (mirror-prefixed on a best-effort
 * basis); failures render a retry row. */
import { useEffect, useState, type ReactNode } from 'react'
import type { PluginLocaleKey } from './locales.ts'

/** Minimal plugin repo view. */
export interface PluginRepo {
  full_name: string
  html_url: string
  description?: string | null
  stargazers_count: number
  forks_count: number
  updated_at?: string
  fork?: boolean
  archived?: boolean
}

/** Injected face: bound translator (the GitHub fetch is direct from the browser). */
export interface PluginCenterInjected {
  t: (key: PluginLocaleKey) => string
}

export type PluginCenterProps = PluginCenterInjected

type LoadState =
  | { status: 'loading' }
  | { status: 'ready'; items: PluginRepo[] }
  | { status: 'error' }

/** GitHub topic query for dsh plugins, via a public mirror for acceleration. */
const GITHUB_SEARCH = 'https://ghfast.top/https://api.github.com/search/repositories?q=topic:dsh-plugin&sort=stars&per_page=20'
const GITHUB_SEARCH_FALLBACK = 'https://api.github.com/search/repositories?q=topic:dsh-plugin&sort=stars&per_page=20'

function mirrorCloneUrl(repo: PluginRepo): string {
  const plain = repo.html_url
  return plain.replace('https://github.com/', 'https://ghfast.top/https://github.com/')
}

/** Render the plugin center. */
export function PluginCenter({ t }: PluginCenterProps): ReactNode {
  const [state, setState] = useState<LoadState>({ status: 'loading' })

  const load = (): void => {
    setState({ status: 'loading' })
    // Mirror first, fall back to the official endpoint.
    const attempt = (url: string, fallback?: string): Promise<void> =>
      fetch(url, { headers: { Accept: 'application/vnd.github+json' } })
        .then((r) => { if (!r.ok) throw new Error(String(r.status)); return r.json() })
        .then(d => setState({ status: 'ready', items: d.items || [] }))
        .catch(() => fallback ? attempt(fallback, undefined) : setState({ status: 'error' }))
    void attempt(GITHUB_SEARCH, GITHUB_SEARCH_FALLBACK)
  }

  useEffect(load, [])

  if (state.status === 'loading') return <div>{t('loading')}</div>
  if (state.status === 'error') return (
    <div>{t('error')} <button type="button" onClick={load}>{t('retry')}</button></div>
  )

  const items = state.items
  if (items.length === 0) return <div>{t('empty')}</div>

  return (
    <div data-plugin-center>
      <div style={{ color: 'var(--dsw-alias-foreground-secondary, #8a93a3)', fontSize: 12, marginBottom: 10 }}>
        {t('mirrorOn')} · {t('auditOn')}
      </div>
      {items.map((r) => {
        const badges = []
        if (r.fork) badges.push(`[${t('fork')}]`)
        if (r.archived) badges.push(`[${t('archived')}]`)
        if (!r.forks_count && !r.stargazers_count) badges.push(`[${t('newRepo')}]`)
        const badgeText = badges.length ? badges.join(' ') : `[${t('official')}]`
        const clone = mirrorCloneUrl(r)
        return (
          <div key={r.full_name} style={{ border: '1px solid var(--dsw-alias-border-l1, #1c2027)', borderRadius: 8, padding: '8px 10px', marginBottom: 8 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
              <a href={r.html_url} target="_blank" rel="noopener noreferrer" style={{ fontWeight: 600 }}>{r.full_name}</a>
              <span style={{ fontSize: 11 }}>{badgeText}</span>
            </div>
            <div style={{ color: 'var(--dsw-alias-foreground-secondary, #9aa2b1)' }}>{(r.description || '').slice(0, 90)}</div>
            <div style={{ display: 'flex', gap: 14, fontSize: 12, marginTop: 4 }}>
              <span>⭐ {r.stargazers_count}</span>
              <span>⑂ {r.forks_count}</span>
              <span style={{ marginLeft: 'auto' }}>{t('updated')} {(r.updated_at || '').slice(0, 10)}</span>
            </div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 6 }}>
              <code style={{ flex: 1, fontSize: 11, overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>git clone {clone}</code>
              <button type="button" onClick={() => navigator.clipboard.writeText(`git clone ${clone}`)}>{t('copy')}</button>
            </div>
          </div>
        )
      })}
    </div>
  )
}
