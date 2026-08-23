import { clientBundle } from '../tsdown.client.ts'

/**
 * ui-update is browser-only in its visible surface, but follows the standard
 * client-plugin shape: the host pass tsc-emits src/ to lib/types (index.js),
 * and the client bundle is built from `lib/types/client/index.js` with the
 * standard loader banner/footer. Its host `apply` is a no-op.
 */
export default clientBundle('@deepseek-ai/dsh-client-ui-update', ['lib/types/index.js'])
