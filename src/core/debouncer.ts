/**
 * Debouncer — provider-agnostic sliding-window debounce for activity scanning.
 *
 * Coalesces rapid activity from the same source + actor into a single scan.
 * The debouncer is pure logic: it computes when the next scan should fire
 * based on the quiet window and max wait deadline. The actual scheduling
 * (setTimeout, Convex scheduler, etc.) is delegated to the caller.
 */

export interface DebounceState {
  quietUntil: number;
  maxWaitAt: number;
}

export const DEFAULT_QUIET_MS = 12_000;
export const MAX_QUIET_MS = 60_000;

/** Clamp a quiet window to [1s, 60s]. */
export function clampQuietMs(value: number | undefined): number {
  if (!Number.isFinite(value ?? DEFAULT_QUIET_MS)) return DEFAULT_QUIET_MS;
  return Math.max(1_000, Math.min(value ?? DEFAULT_QUIET_MS, MAX_QUIET_MS));
}

/**
 * Compute the next debounce state for a sliding-window debounce.
 *
 * - If no existing state: create fresh with quietUntil = now + delay, maxWaitAt = now + MAX_QUIET_MS.
 * - If existing pending state: slide the window (quietUntil = now + delay), but
 *   cap at maxWaitAt so a typing-forever actor still fires eventually.
 *
 * @param now - Current timestamp (injectable for testing)
 * @param existing - Existing debounce state, or null for new
 * @param quietMs - Requested quiet window
 * @returns The new debounce state and the effective delay
 */
export function computeDebounce(
  now: number,
  existing: DebounceState | null,
  quietMs: number,
): { state: DebounceState; effectiveDelay: number } {
  const delay = clampQuietMs(quietMs);
  const maxWaitAt = existing
    ? existing.maxWaitAt
    : now + MAX_QUIET_MS;
  const effectiveDelay = Math.max(1, Math.min(delay, maxWaitAt - now));
  return {
    state: { quietUntil: now + effectiveDelay, maxWaitAt },
    effectiveDelay,
  };
}
