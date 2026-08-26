/** Plugin-center feature: registers a "插件中心" settings section that browses
 * GitHub #dsh-plugin repos with mirror-accelerated clone links and security
 * signals. */
import type { ClientContext } from '@deepseek-ai/dsh-client-runtime/client'
import type {} from '@deepseek-ai/dsh-client-ui-slots'
import type {} from '@deepseek-ai/dsh-client-ui-settings/client'
import type {} from '@deepseek-ai/dsh-client-locale/client'
import { PluginCenter } from './PluginCenter.tsx'
import type { PluginCenterInjected } from './PluginCenter.tsx'
import { en, zh, type PluginLocaleKey } from './locales.ts'

/** Locale namespace this feature owns. */
const NS = 'settings.pluginCenter'

declare module '@deepseek-ai/dsh-client-ui-slots' {
  interface LocaleNamespaceMap {
    'settings.pluginCenter': PluginLocaleKey
  }
}

/** Required services (cordis fiber inject). */
export const inject = ['slots', 'locale']

/** Register the plugin-center section and provide the bound copy dictionaries. */
export function apply(ctx: ClientContext): void {
  ctx.effect(() => ctx.locale.register(NS, { zh, en }), 'ui-plugin-center: copy dictionaries')

  const t = ctx.locale.bind(NS) as (key: PluginLocaleKey) => string
  const injected = (): PluginCenterInjected => ({ t })

  ctx.slots.inject('settings.section', () => ctx.slots.register({
    name: 'settings.section',
    id: 'plugin-center',
    order: 50,
    label: () => t('nav'),
    locale: NS,
    inject: injected,
  }, PluginCenter))
}
