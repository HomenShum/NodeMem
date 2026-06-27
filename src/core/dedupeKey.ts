/**
 * Activity dedupe key — deterministic key for coalescing rapid activity from
 * the same source + actor. Used by the debouncer to decide whether to
 * create a new outbox row or update an existing one.
 */

export type SourceKind =
  | "node"
  | "element"
  | "artifact_element"
  | "artifact"
  | "upload"
  | "message"
  | "wiki_revision";

export type EventKind =
  | "idle_after_typing"
  | "cell_committed"
  | "file_uploaded"
  | "manual_enqueue"
  | "content_committed"
  | "page_hidden"
  | "manual_save"
  | "artifact_imported";

export interface ActivityDedupeArgs {
  roomId: string;
  sourceKind: SourceKind;
  sourceId: string;
  eventKind: EventKind;
  /** Per-actor scope: each author gets their own quiet window. */
  actorId?: string;
  ownerId?: string;
}

export type ActivityEvent = ActivityDedupeArgs & {
  sourceVersion?: number;
  sourceHash: string;
  visibility?: "private" | "room" | "public";
  quietMs?: number;
};

/** Build a deterministic dedupe key for an activity event. */
export function activityDedupeKey(args: ActivityDedupeArgs): string {
  return [
    "activity",
    args.roomId,
    args.sourceKind,
    args.sourceId,
    args.eventKind,
    args.actorId ?? args.ownerId ?? "room",
  ].join(":");
}
