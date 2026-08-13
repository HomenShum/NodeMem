/**
 * How much passive noticing a room is allowed to do.
 *
 * The person this is for: whoever owns a room and does not want a background
 * system talking to them during a client call. They set a mode; the product
 * that embeds NodeMem may also impose its own ceiling (a free tier, a locked
 * workspace). When those two disagree, the quieter one wins — a room can always
 * ask for less noticing than the system allows, never more.
 */

import type { PolicyStore } from "./ports.js";

export type AssistiveMode =
  | "off"
  | "suggestions_only"
  | "ask_before_research"
  | "approved_watchlist_only";

/** Most restrictive first. Position in this list is the comparison. */
const MODE_RESTRICTION_ORDER: AssistiveMode[] = [
  "off",
  "approved_watchlist_only",
  "ask_before_research",
  "suggestions_only",
];

export interface AssistivePolicy {
  mode: AssistiveMode;
  allowExternalCalls: boolean;
  maxSuggestionsPerHour: number;
  maxApprovedBackgroundJobsPerDay: number;
  disabledSignalKinds: string[];
  approvedEntityWatchlist: string[];
  source: "system_default" | "room_policy";
}

/** What a room gets when nobody has set anything: suggestions, no auto-jobs. */
const SYSTEM_DEFAULT_POLICY: AssistivePolicy = {
  mode: "suggestions_only",
  allowExternalCalls: true,
  maxSuggestionsPerHour: 10,
  maxApprovedBackgroundJobsPerDay: 5,
  disabledSignalKinds: [],
  approvedEntityWatchlist: [],
  source: "system_default",
};

/**
 * Combine the system default with the room's own policy, quieter setting wins.
 *
 * @returns the effective policy; `source` says whether a room policy existed.
 */
export async function resolveAssistivePolicy(
  store: PolicyStore,
  roomId: string,
  systemDefault?: Partial<AssistivePolicy>,
): Promise<AssistivePolicy> {
  const system: AssistivePolicy = { ...SYSTEM_DEFAULT_POLICY, ...systemDefault };
  const room = await store.getRoomPolicy(roomId);
  if (!room) return system;

  const systemIsQuieter =
    MODE_RESTRICTION_ORDER.indexOf(system.mode) <= MODE_RESTRICTION_ORDER.indexOf(room.mode);

  return {
    mode: systemIsQuieter ? system.mode : room.mode,
    allowExternalCalls: room.allowExternalCalls && system.allowExternalCalls,
    maxSuggestionsPerHour: Math.min(room.maxSuggestionsPerHour, system.maxSuggestionsPerHour),
    maxApprovedBackgroundJobsPerDay: Math.min(
      room.maxApprovedBackgroundJobsPerDay,
      system.maxApprovedBackgroundJobsPerDay,
    ),
    disabledSignalKinds: [...new Set([...room.disabledSignalKinds, ...system.disabledSignalKinds])],
    approvedEntityWatchlist: room.approvedEntityWatchlist,
    source: "room_policy",
  };
}

/** Has the room muted this kind of signal? */
export function isSignalDisabled(disabledKinds: string[], signalKinds: string[]): boolean {
  if (!disabledKinds.length) return false;
  return signalKinds.some((k) => disabledKinds.includes(k));
}

/** Is this entity one the room pre-approved? Case- and space-insensitive. */
export function isEntityWatchlisted(watchlist: string[], entityNames: string[]): boolean {
  if (!watchlist.length) return false;
  const allowed = new Set(watchlist.map((w) => w.toLowerCase().trim()));
  return entityNames.some((e) => allowed.has(e.toLowerCase().trim()));
}
