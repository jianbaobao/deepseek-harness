import { clientBundle } from '../tsdown.client.ts'

/**
 * ui-plugin-center follows the standard client-plugin shape: host tsc-emits
 * src/ to lib/types (index.js) and the client bundle is built from
 * `lib/types/client/index.js` with the standard loader banner/footer.
 */
export default clientBundle('@deepseek-ai/dsh-client-ui-plugin-center', ['lib/types/index.js'])
