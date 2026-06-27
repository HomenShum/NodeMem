/**
 * In-memory adapter — zero-dependency reference implementation of MemoryStore.
 *
 * Use for testing, demos, and local development. No persistence.
 * For production, use the Convex adapter or implement your own.
 */

import type { NoteworthyFinding } from "../core/classifier.js";
import type { NoteworthyRow } from "../core/dedup.js";
import type { DismissalEntry } from "../core/dismissalLearner.js";
import type { AssistivePolicy } from "../core/policyResolver.js";
import type { MemoryStore, ActivityStatus, ScanInput } from "../core/scanOrchestrator.js";

interface StoredRow extends NoteworthyRow {
  finding?: NoteworthyFinding;
  reason?: string;
  text?: string;
  visibility: string;
  ownerId?: string;
  createdAt: number;
}

interface StoredDismissal extends DismissalEntry {}

interface StoredPolicy extends AssistivePolicy {}

/**
 * Full in-memory implementation of MemoryStore.
 * Also provides methods for inserting activity rows and listing noteworthy items.
 */
export class InMemoryAdapter implements MemoryStore {
  private rows = new Map<string, StoredRow>();
  private dismissals = new Map<string, StoredDismissal[]>();
  private policies = new Map<string, StoredPolicy>();
  private nextId = 0;

  /** Insert an activity row and return its id. */
  insertActivity(input: Omit<ScanInput, "id">): string {
    const id = `row-${++this.nextId}`;
    const row: StoredRow = {
      id,
      roomId: input.roomId,
      status: "queued",
      entityNames: [],
      updatedAt: Date.now(),
      createdAt: Date.now(),
      visibility: input.visibility,
      ownerId: input.ownerId,
    };
    this.rows.set(id, row);
    return id;
  }

  /** Get a row by id. */
  getRow(id: string): StoredRow | undefined {
    return this.rows.get(id);
  }

  /** List all noteworthy rows for a room. */
  listNoteworthyRows(roomId: string): StoredRow[] {
    return [...this.rows.values()]
      .filter((r) => r.roomId === roomId && r.status === "noteworthy")
      .sort((a, b) => b.updatedAt - a.updatedAt);
  }

  // --- MemoryStore implementation ---

  async patchRow(
    id: string,
    patch: { status: ActivityStatus; finding?: NoteworthyFinding; reason?: string; updatedAt: number },
  ): Promise<void> {
    const row = this.rows.get(id);
    if (!row) return;
    row.status = patch.status;
    if (patch.finding) {
      row.finding = patch.finding;
      row.entityNames = patch.finding.entities.map((e) => e.displayName);
    }
    if (patch.reason) row.reason = patch.reason;
    row.updatedAt = patch.updatedAt;
  }

  async listNoteworthy(roomId: string, limit = 50): Promise<NoteworthyRow[]> {
    return this.listNoteworthyRows(roomId)
      .slice(0, limit)
      .map((r) => ({
        id: r.id,
        roomId: r.roomId,
        status: r.status,
        entityNames: r.entityNames,
        updatedAt: r.updatedAt,
        finding: r.finding,
      }));
  }

  async countNoteworthyLastHour(roomId: string): Promise<number> {
    const oneHourAgo = Date.now() - 60 * 60 * 1000;
    return this.listNoteworthyRows(roomId).filter((r) => r.updatedAt >= oneHourAgo).length;
  }

  async isEntityDismissed(roomId: string, entityNames: string[]): Promise<boolean> {
    if (!entityNames.length) return false;
    const dismissed = this.dismissals.get(roomId) ?? [];
    const dismissedSet = new Set(dismissed.map((d) => d.entityName.toLowerCase().trim()));
    return entityNames.some((name) => dismissedSet.has(name.toLowerCase().trim()));
  }

  async recordDismissal(roomId: string, entityNames: string[], dismissedBy: string): Promise<void> {
    const existing = this.dismissals.get(roomId) ?? [];
    const now = Date.now();
    for (const name of entityNames) {
      const key = name.toLowerCase().trim();
      const existingEntry = existing.find((d) => d.entityName === key);
      if (existingEntry) {
        existingEntry.dismissedBy = dismissedBy;
        existingEntry.dismissedAt = now;
        existingEntry.dismissCount++;
      } else {
        existing.push({
          roomId,
          entityName: key,
          dismissedBy,
          dismissedAt: now,
          dismissCount: 1,
        });
      }
    }
    this.dismissals.set(roomId, existing);
  }

  async listDismissed(roomId: string): Promise<DismissalEntry[]> {
    return [...(this.dismissals.get(roomId) ?? [])];
  }

  async getRoomPolicy(roomId: string): Promise<AssistivePolicy | null> {
    return this.policies.get(roomId) ?? null;
  }

  async setRoomPolicy(roomId: string, policy: Omit<AssistivePolicy, "source">): Promise<void> {
    this.policies.set(roomId, { ...policy, source: "room_policy" });
  }

  // --- Test helpers ---

  /** Clear all state. */
  clear(): void {
    this.rows.clear();
    this.dismissals.clear();
    this.policies.clear();
    this.nextId = 0;
  }

  /** Get all rows for debugging. */
  getAllRows(): StoredRow[] {
    return [...this.rows.values()];
  }
}
