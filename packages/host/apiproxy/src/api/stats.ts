/**
 * stats domain contract: session usage and account stats surfaced to the
 * desktop status bar / stats panel. Values are read-only aggregates; no wire
 * secrets cross this domain (the API key stays server-side).
 */

import type { RpcRequest, RpcResponse } from './rpc.ts'

/** Aggregate token counters for the current session. */
export interface StatsTokens {
  /** Total tokens measured across the session surface (heuristic or provider usage). */
  total: number
  /** Provider-reported cache-read (prefix-hit) tokens when the last call reported them. */
  cacheRead?: number
  /** Provider-reported uncached input tokens. */
  uncachedInput?: number
  /** Provider-reported output tokens. */
  output?: number
}

/** stats.describe response value. */
export interface StatsDescription {
  /** Model the current/default session runs. */
  model?: string
  /** Workspace root (host cwd). */
  workspace?: string
  /** Conversation rounds in the current session, when known. */
  rounds: number
  /** Token counters. */
  tokens: StatsTokens
}

/** Stats-domain unary methods. */
export interface StatsApi {
  /**
   * One-shot session/account stats snapshot. Empty payload uses `{}`; the
   * value carries model, workspace, rounds, and token counters. Balance is
   * intentionally absent: it is a provider-account concern served by the
   * desktop shell, not the harness session.
   */
  describe(request: RpcRequest<{}>): Promise<RpcResponse<StatsDescription>>
}
