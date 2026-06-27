/**
 * Convex adapter for NodeMem — schema definitions.
 *
 * This is the Convex proof. The schema is designed to be dropped into a
 * Convex project's `convex/` directory. It defines the tables that back
 * the MemoryStore port:
 *
 * - roomActivityOutbox: debounced activity rows (the inbox)
 * - roomDismissedEntities: entity-level dismissal learning
 * - roomAssistivePolicies: per-room assistive intelligence policy
 * - suggestionFeedback: signal-scoped dismissal feedback
 * - roomSuggestionDigests: grouped summaries for high-volume rooms
 *
 * Copy this file into your Convex project and import the table definitions
 * into your schema.ts. Or use the full adapter module (convex/nodemem.ts).
 */

import { defineTable, defineSchema } from "convex/server";
import { v } from "convex/values";

const actor = v.object({
  kind: v.union(v.literal("user"), v.literal("agent")),
  id: v.string(),
  name: v.string(),
  scope: v.union(v.literal("private"), v.literal("room"), v.literal("public")),
});

const visibilityV = v.union(v.literal("private"), v.literal("room"), v.literal("public"));

const sourceKindV = v.union(
  v.literal("node"),
  v.literal("element"),
  v.literal("artifact_element"),
  v.literal("artifact"),
  v.literal("upload"),
  v.literal("message"),
  v.literal("wiki_revision"),
);

const eventKindV = v.union(
  v.literal("idle_after_typing"),
  v.literal("cell_committed"),
  v.literal("file_uploaded"),
  v.literal("manual_enqueue"),
  v.literal("content_committed"),
  v.literal("page_hidden"),
  v.literal("manual_save"),
  v.literal("artifact_imported"),
);

/** Export individual table definitions so they can be merged into an existing schema. */
export const roomActivityOutbox = defineTable({
  roomId: v.id("rooms"),
  sourceKind: sourceKindV,
  sourceId: v.string(),
  sourceVersion: v.optional(v.number()),
  sourceHash: v.string(),
  eventKind: eventKindV,
  status: v.union(
    v.literal("queued"),
    v.literal("running"),
    v.literal("scanning"),
    v.literal("completed"),
    v.literal("ignored"),
    v.literal("not_noteworthy"),
    v.literal("noteworthy"),
    v.literal("job_created"),
    v.literal("failed"),
  ),
  actor: v.optional(actor),
  visibility: visibilityV,
  ownerId: v.optional(v.string()),
  dedupeKey: v.string(),
  quietUntil: v.number(),
  maxWaitAt: v.optional(v.number()),
  dismissedBy: v.optional(v.string()),
  attempts: v.number(),
  latestJobId: v.optional(v.string()),
  decision: v.optional(v.any()),
  finding: v.optional(v.any()),
  error: v.optional(v.string()),
  createdAt: v.number(),
  updatedAt: v.number(),
  lastScannedAt: v.optional(v.number()),
})
  .index("by_status_quietUntil", ["status", "quietUntil"])
  .index("by_room", ["roomId", "updatedAt"])
  .index("by_room_status", ["roomId", "status", "updatedAt"])
  .index("by_room_status_quietUntil", ["roomId", "status", "quietUntil"])
  .index("by_room_source", ["roomId", "sourceKind", "sourceId"])
  .index("by_dedupe", ["dedupeKey", "updatedAt"])
  .index("by_source", ["sourceKind", "sourceId", "updatedAt"])
  .index("by_room_visibility_updated", ["roomId", "visibility", "updatedAt"])
  .index("by_room_owner_visibility_updated", ["roomId", "ownerId", "visibility", "updatedAt"]);

export const roomDismissedEntities = defineTable({
  roomId: v.id("rooms"),
  entityName: v.string(),
  dismissedBy: v.string(),
  dismissedAt: v.number(),
  dismissCount: v.number(),
})
  .index("by_room_entity", ["roomId", "entityName"])
  .index("by_room", ["roomId", "dismissedAt"]);

export const roomAssistivePolicies = defineTable({
  roomId: v.id("rooms"),
  mode: v.union(
    v.literal("off"),
    v.literal("suggestions_only"),
    v.literal("ask_before_research"),
    v.literal("approved_watchlist_only"),
  ),
  allowExternalCalls: v.boolean(),
  maxSuggestionsPerHour: v.number(),
  maxApprovedBackgroundJobsPerDay: v.number(),
  disabledSignalKinds: v.array(v.string()),
  approvedEntityWatchlist: v.array(v.string()),
  updatedBy: v.string(),
  updatedAt: v.number(),
})
  .index("by_room", ["roomId"]);

export const suggestionFeedback = defineTable({
  roomId: v.id("rooms"),
  userId: v.string(),
  suggestionId: v.id("roomActivityOutbox"),
  entity: v.optional(v.string()),
  signalFingerprintHash: v.string(),
  dismissReason: v.union(
    v.literal("wrong_entity"),
    v.literal("not_relevant"),
    v.literal("too_noisy"),
    v.literal("already_handled"),
    v.literal("sensitive"),
    v.literal("other"),
  ),
  scope: v.union(
    v.literal("item"),
    v.literal("entity"),
    v.literal("signal"),
    v.literal("room"),
  ),
  expiresAt: v.optional(v.number()),
  createdAt: v.number(),
})
  .index("by_room_signal", ["roomId", "signalFingerprintHash"])
  .index("by_room_entity", ["roomId", "entity"])
  .index("by_suggestion", ["suggestionId"]);

export const roomSuggestionDigests = defineTable({
  roomId: v.id("rooms"),
  groupKey: v.string(),
  groupKind: v.string(),
  title: v.string(),
  summary: v.string(),
  count: v.number(),
  sampleSuggestionIds: v.array(v.id("roomActivityOutbox")),
  highestPriority: v.number(),
  status: v.union(v.literal("open"), v.literal("archived")),
  updatedAt: v.number(),
})
  .index("by_room_status", ["roomId", "status"]);

/** Full schema for a standalone NodeMem Convex deployment. */
export default defineSchema({
  rooms: defineTable({
    name: v.string(),
    ownerId: v.string(),
    createdAt: v.number(),
  }),
  roomActivityOutbox,
  roomDismissedEntities,
  roomAssistivePolicies,
  suggestionFeedback,
  roomSuggestionDigests,
});
