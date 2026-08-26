/** Stats-panel feature: registers a "统计" settings section whose page reads
 * the session usage snapshot from the host stats domain (stats.describe). */
import type { ClientContext } from '@deepseek-ai/dsh-client-runtime/client'
import type {} from '@deepseek-ai/dsh-client-ui-slots'
import type {} from '@deepseek-ai/dsh-client-ui-settings/client'
import type {} from '@deepseek-ai/dsh-client-locale/client'
import { StatsPanel } from './StatsPanel.tsx'
import type { StatsPanelInjected } from './StatsPanel.tsx'
import { en, zh, type StatsLocaleKey } from './locales.ts'

/** Locale namespace this feature owns. */
const NS = 'settings.stats'

declare module '@deepseek-ai/dsh-client-ui-slots' {
  interface LocaleNamespaceMap {
    'settings.stats': StatsLocaleKey
  }
}

/** Required services (cordis fiber inject). */
export const inject = ['slots', 'locale', 'connection']

/** Register the stats section and provide the bound copy dictionaries. */
export function apply(ctx: ClientContext): void {
  ctx.effect(() => ctx.locale.register(NS, { zh, en }), 'ui-stats-panel: copy dictionaries')

  const t = ctx.locale.bind(NS) as (key: StatsLocaleKey) => string
  const injected = (): StatsPanelInjected => ({
    api: (ctx.get('connection') as { api: { stats: StatsPanelInjected['api']['stats'] } }).api,
    t,
  })

  ctx.slots.inject('settings.section', () => ctx.slots.register({
    name: 'settings.section',
    id: 'stats',
    order: 45,
    label: () => t('nav'),
    locale: NS,
    inject: injected,
  }, StatsPanel))
}
