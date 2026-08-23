/**
 * Update-check feature: registers the "升级" row into the General settings
 * section's item slot. The host runs the GitHub probe (host.checkUpdate), so
 * the browser never needs cross-origin access; transient failures render as a
 * quiet "check failed" row instead of breaking the settings page.
 *
 * @module @deepseek-ai/dsh-client-ui-update
 */
import type { ClientContext } from '@deepseek-ai/dsh-client-runtime/client'
// Type-only: pulls the shell's SlotMap merge (the 'settings.general.item' entry)
// and the locale plugin's Context merge (ctx.locale).
import type {} from '@deepseek-ai/dsh-client-ui-slots'
import type {} from '@deepseek-ai/dsh-client-ui-settings/client'
import type {} from '@deepseek-ai/dsh-client-locale/client'
import { UpdateRow } from './UpdateRow.tsx'
import type { CheckUpdateApi, UpdateRowInjected } from './UpdateRow.tsx'
import { en, zh, type UpdateLocaleKey } from './locales.ts'

/** Locale namespace this feature owns. */
const NS = 'settings.update'

declare module '@deepseek-ai/dsh-client-ui-slots' {
  interface LocaleNamespaceMap {
    /** This feature's own settings-row copy (the Upgrade row). */
    'settings.update': UpdateLocaleKey
  }
}

/** Required services (cordis fiber inject): the slot registry, locale, and connection. */
export const inject = ['slots', 'locale', 'connection']

/**
 * Register the update row into the General settings item slot and provide the
 * bound copy dictionaries.
 * @param ctx - client cordis context.
 */
export function apply(ctx: ClientContext): void {
  ctx.effect(() => ctx.locale.register(NS, { zh, en }), 'ui-update: copy dictionaries')

  const t = ctx.locale.bind(NS) as (key: UpdateLocaleKey) => string
  const injected = (): UpdateRowInjected => ({
    // ctx.connection carries the host `api` (IApiClient); we only use the
    // HostApi's checkUpdate, so type it against the minimal surface.
    api: (ctx.get('connection') as unknown as { api: CheckUpdateApi }).api,
    t,
  })

  ctx.slots.inject('settings.general.item', () => ctx.slots.register({
    name: 'settings.general.item',
    id: 'update',
    order: 100, // after language and agent-preset rows
    locale: NS,
    inject: injected,
  }, UpdateRow))
}
