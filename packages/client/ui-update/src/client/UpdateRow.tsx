/** The "升级" row in the General settings: shows current/latest version and
 * offers the download link when a newer release exists. Uses the host-side
 * `host.checkUpdate` RPC so the browser never needs cross-origin access. */
import { useState, type ReactNode } from 'react'
import type { UpdateLocaleKey } from './locales.ts'

/** Minimal host-check-update surface (avoids a cross-package type import). */
export interface CheckUpdateApi {
  host: {
    checkUpdate(request: { currentVersion?: string }): Promise<{
      result: { ok: true; value: { currentVersion: string; latestVersion?: string; available: boolean; downloadUrl?: string } } | { ok: false }
    }>
  }
}

/** Injected face: the host API selected to the checkUpdate call plus the bound translator. */
export interface UpdateRowInjected {
  api: CheckUpdateApi
  t: (key: UpdateLocaleKey) => string
}

/** Row component props = injected face (locale seat is provided by the shell). */
export type UpdateRowProps = UpdateRowInjected

interface CheckStateDone {
  status: 'done'
  current: string
  latest?: string
  available: boolean
  downloadUrl?: string
}

type CheckState =
  | { status: 'idle' }
  | { status: 'checking' }
  | CheckStateDone
  | { status: 'failed' }

/** Render the update-check row. */
export function UpdateRow({ api, t }: UpdateRowProps): ReactNode {
  const [state, setState] = useState<CheckState>({ status: 'idle' })

  const check = (): void => {
    setState({ status: 'checking' })
    void api.host.checkUpdate({}).then(
      (response) => {
        if (!response.result.ok) { setState({ status: 'failed' }); return }
        const value = response.result.value
        const done: CheckStateDone = {
          status: 'done',
          current: value.currentVersion,
          available: value.available,
          ...(value.latestVersion !== undefined ? { latest: value.latestVersion } : {}),
          ...(value.downloadUrl !== undefined ? { downloadUrl: value.downloadUrl } : {}),
        }
        setState(done)
      },
      () => setState({ status: 'failed' }),
    )
  }

  return (
    <div data-update-row>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
        <div>
          <div>{t('label')}</div>
          <div style={{ color: 'var(--font-secondary, #8a93a3)', fontSize: 12 }}>{t('hint')}</div>
        </div>
        <button type="button" onClick={check} disabled={state.status === 'checking'}>
          {state.status === 'checking' ? t('checking') : t('check')}
        </button>
      </div>
      {state.status === 'done' ? (
        <div style={{ marginTop: 8, fontSize: 13 }}>
          <div>{t('current')}: {state.current}</div>
          {state.available && state.latest !== undefined ? (
            <div style={{ color: 'var(--danger, #f87171)' }}>
              {t('updateAvailable')}: {state.latest} · <a href={state.downloadUrl} target="_blank" rel="noopener noreferrer">{t('goDownload')}</a>
            </div>
          ) : (
            <div style={{ color: 'var(--success, #4ade80)' }}>{t('upToDate')}</div>
          )}
        </div>
      ) : state.status === 'failed' ? (
        <div style={{ marginTop: 8, color: 'var(--danger, #f87171)', fontSize: 13 }}>{t('failed')}</div>
      ) : null}
    </div>
  )
}
