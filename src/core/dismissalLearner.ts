/**
 * Dismissal learner — tracks entities that users have dismissed and suppresses
 * future suggestions for the same entity.
 *
 * Provider-agnostic: the store interface is a port. Implement it with Convex,
 * SQLite, Postgres, or any KV store.
 */

export interface DismissalEntry {
  roomId: string;
  entityName: string;
  dismissedBy: string;
  dismissedAt: number;
  dismissCount: number;
}

/**
 * Port contract for dismissal persistence.
 * Implement this with any backend (Convex, SQLite, in-memory, etc.).
 */
export interface DismissalStore {
  /** Check if any of the given entity names have been dismissed in this room. */
  isEntityDismissed(roomId: string, entityNames: string[]): Promise<boolean>;
  /** Record a dismissal for one or more entities. */
  recordDismissal(roomId: string, entityNames: string[], dismissedBy: string): Promise<void>;
  /** List all dismissed entities for a room (for debugging/UI). */
  listDismissed(roomId: string): Promise<DismissalEntry[]>;
}

/**
 * Pure function: check if any entity name matches a dismissed set.
 * Useful for in-memory testing or pre-filtering before a store lookup.
 */
export function isEntityDismissedSync(
  dismissed: Set<string>,
  entityNames: string[],
): boolean {
  if (!entityNames.length) return false;
  return entityNames.some((name) => dismissed.has(name.toLowerCase().trim()));
}

/**
 * Check if any of the entities were previously dismissed.
 * Delegates to the store implementation.
 */
export async function isEntityDismissed(
  store: DismissalStore,
  roomId: string,
  entityNames: string[],
): Promise<boolean> {
  if (!entityNames.length) return false;
  return store.isEntityDismissed(roomId, entityNames);
}
