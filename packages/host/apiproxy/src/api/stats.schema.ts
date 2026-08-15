import { z } from 'zod'
import type { Wire } from './rpc.schema.ts'
import type { RequestPayload } from './rpc-map.ts'

/** stats.describe request payload (empty object literal). */
export const statsDescribeRequestSchema = z.object({}) satisfies z.ZodType<Wire<RequestPayload<'stats.describe'>>>

/** stats.describe response value. */
export const statsDescribeValueSchema = z.object({
  model: z.string().optional(),
  workspace: z.string().optional(),
  rounds: z.number().int().nonnegative(),
  tokens: z.object({
    total: z.number().int().nonnegative(),
    cacheRead: z.number().int().nonnegative().optional(),
    cacheWrite: z.number().int().nonnegative().optional(),
    uncachedInput: z.number().int().nonnegative().optional(),
    output: z.number().int().nonnegative().optional(),
  }),
  cacheHitRate: z.number().min(0).max(100).optional(),
  costEstimateCny: z.number().nonnegative().optional(),
})
