import { clientOnly } from '../tsdown.client.ts'

/**
 * ui-update is browser-only: the "升级" row is a client plugin; its host entry
 * is an empty registration face. The client bundle emits from the compiled
 * `lib/types/client/index.js`.
 */
export default clientOnly([{
  entry: ['lib/types/client/index.js'],
  outDir: 'lib',
  format: ['esm'],
  platform: 'neutral',
  target: 'es2024',
  fixedExtension: false,
  dts: false,
  clean: false,
}])
