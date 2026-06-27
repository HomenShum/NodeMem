/**
 * Dedup + quota — prevents duplicate noteworthy suggestions for the same entity
 * and caps the number of active suggestions per room per hour.
 *
 * Provider-agnostic: the store interface is a port.
 */

import type { NoteworthyFinding } from "./classifier.js";

/** A noteworthy row as stored by the adapter. */
export interface NoteworthyRow {
  id: string;
  roomId: string;
  status: string;
  entityNames: string[];
  updatedAt: number;
  finding?: NoteworthyFinding;
}

/**
 * Port contract for dedup + quota queries.
 * Implement this with any backend.
 */
export interface DedupStore {
  /** Find active noteworthy rows for a room (status = "noteworthy"). */
  listNoteworthy(roomId: string, limit?: number): Promise<NoteworthyRow[]>;
  /** Count noteworthy rows created in the last hour for a room. */
  countNoteworthyLastHour(roomId: string): Promise<number>;
}

/** Feed staleness: only consider rows from the last 2 days for dedup. */
export const FEED_STALENESS_MS = 2 * 24 * 60 * 60 * 1000;

/**
 * Check if a room already has an active noteworthy suggestion for any of the
 * given entity names. Prevents duplicate inbox items.
 */
export async function findExistingNoteworthyForEntity(
  store: DedupStore,
  roomId: string,
  entityNames: string[],
  excludeId?: string,
): Promise<boolean> {
  if (!entityNames.length) return false;
  const rows = await store.listNoteworthy(roomId, 50);
  const cutoff = Date.now() - FEED_STALENESS_MS;
  const entitySet = new Set(entityNames.map((e) => e.toLowerCase().trim()));
  for (const row of rows) {
    if (excludeId && row.id === excludeId) continue;
    if (row.updatedAt < cutoff) continue;
    const existingEntities = row.entityNames.map((e) => e.toLowerCase().trim()).filter(Boolean);
    if (existingEntities.some((e) => entitySet.has(e))) return true;
  }
  return false;
}

/**
 * Check if a room has exceeded its per-hour noteworthy quota.
 */
export async function roomNoteworthyQuotaExceeded(
  store: DedupStore,
  roomId: string,
  maxPerHour: number,
): Promise<boolean> {
  const count = await store.countNoteworthyLastHour(roomId);
  return count >= maxPerHour;
}
