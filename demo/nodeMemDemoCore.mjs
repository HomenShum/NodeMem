/**
 * A plain-JavaScript copy of the classifier, for the two demo surfaces that
 * cannot load TypeScript: `runNodeMemDemo.mjs` (runs with no install and no
 * build) and `graph-rail/` (runs in a browser with no bundler).
 *
 * **`src/core/classifier.ts` is the original. This file must not disagree with
 * it.** `tests/demoMirror.test.ts` runs both over the same corpus and fails if
 * they ever do — they already drifted once, and the demo copy invented a
 * company called "The Next Series" that the library correctly ignored.
 *
 * Change the TypeScript first, then mirror it here.
 */

const CLASSIFIER_VERSION = "noteworthy-v1";
const SIGNAL = {
  ORG_CANDIDATE: "organization_candidate",
  FINANCE_SIGNAL: "finance_signal",
  PERSON_INTERACTION: "person_or_interaction",
  RESEARCH_SIGNAL: "research_signal",
  OPEN_QUESTION_OR_TASK: "open_question_or_task",
  SOURCE_URL: "source_url",
};
const SIGNAL_ORDER = {
  organization_candidate: 0,
  finance_signal: 1,
  person_or_interaction: 2,
  research_signal: 3,
  open_question_or_task: 4,
  source_url: 5,
};
const STOP_NAMES = new Set(["Series", "Next", "The", "This", "Convex", "NodeRoom", "Need", "Follow", "What", "When", "Where", "Why", "How", "That", "They", "Will", "Just", "Have", "Been", "With", "From", "Into", "Only", "Also", "Some", "More", "Most", "Such", "Very", "Much", "Many", "Each", "Both", "All", "Any", "Met", "New", "Check", "See", "Look", "Let", "But", "And", "Or", "Not", "Can", "May", "Might", "Could", "Would", "Should", "Does", "Did", "Has", "Was", "Are", "Is", "Am", "Be", "Been", "Being", "Do", "Done", "Get", "Got", "Put", "Set", "Try", "Use", "Using", "Used", "Make", "Made", "Take", "Took", "Give", "Gave", "Find", "Found", "Tell", "Told", "Ask", "Said", "Went", "Came", "Left", "Right", "Now", "Then", "Here", "There", "Today", "Yesterday", "Tomorrow", "Last", "First", "Best", "Worst", "About", "Above", "Below", "After", "Before", "Between", "Through", "During", "Since", "Until", "Within", "Without", "Against"]);

function firstMatch(text, re) {
  const m = text.match(re);
  return m ? m[0] : null;
}

function normalizeEntityKey(name) {
  return name.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "unknown";
}

export function classifyNoteworthy(text) {
  const lower = text.toLowerCase();
  const signals = new Set();
  const evidenceSpans = [];
  const facets = new Set();

  const add = (signal, span, confidence) => {
    if (!signals.has(signal)) {
      signals.add(signal);
      evidenceSpans.push({ signal, text: span.slice(0, 200), confidence });
    }
  };

  const suffixSpan = firstMatch(text, /\b\w+\s+(inc|corp|labs|llc|ltd|health|bio|ai|technologies|systems|capital|ventures|bank|medical|therapeutics)\b/i);
  if (suffixSpan) add(SIGNAL.ORG_CANDIDATE, suffixSpan, 0.9);

  const candidates = [...text.matchAll(/\b([A-Z][A-Za-z0-9&.-]{2,}(?:\s+[A-Z][A-Za-z0-9&.-]{2,}){0,3})\b/g)]
    .map((m) => m[1])
    .filter((name) => !STOP_NAMES.has(name) && !STOP_NAMES.has(name.split(/\s+/)[0]));
  if (candidates.length && !signals.has(SIGNAL.ORG_CANDIDATE)) add(SIGNAL.ORG_CANDIDATE, candidates[0], 0.7);

  const personSpan = firstMatch(text, /\b(met|spoke|talked|call|founder|ceo|cfo|contact|intro|emailed)\b/i);
  if (personSpan) add(SIGNAL.PERSON_INTERACTION, personSpan, 0.8);

  const financeSpan = firstMatch(text, /\b(series\s+[a-z]|seed|funding|raise|runway|burn|arr|revenue|ebitda|margin|cash)\b/i);
  if (financeSpan) { add(SIGNAL.FINANCE_SIGNAL, financeSpan, 0.85); facets.add("funding"); facets.add("runway_inputs"); }

  const researchSpan = firstMatch(text, /\b(product|launch|announced|customer|pilot|hospital|pricing|competitor|headwind|market|news)\b/i);
  if (researchSpan) { add(SIGNAL.RESEARCH_SIGNAL, researchSpan, 0.8); facets.add("product_news"); facets.add("recent_signal"); }

  const taskSpan = firstMatch(text, /\b(verify|source|follow\s*up|ask|research|find|confirm|todo|next step|backlink|reference)\b/i);
  if (taskSpan) { add(SIGNAL.OPEN_QUESTION_OR_TASK, taskSpan, 0.75); facets.add("source_validation"); }

  const urlSpan = firstMatch(text, /https:\/\/\S+/i);
  if (urlSpan) add(SIGNAL.SOURCE_URL, urlSpan, 0.9);

  const sortedSignals = [...signals].sort((a, b) => SIGNAL_ORDER[a] - SIGNAL_ORDER[b]);
  const displayName = candidates[0] ?? "unknown";
  const entityType = lower.includes("founder") || lower.includes("ceo") || lower.includes("cfo") ? "person" : "company";
  const score = Math.min(1, 0.18 + sortedSignals.length * 0.18);

  return {
    score,
    action: score >= 0.70 ? "start_research_job" : score >= 0.50 ? "create_coach_cue" : score >= 0.35 ? "index_only" : "ignore",
    signals: sortedSignals,
    reasons: sortedSignals,
    evidenceSpans,
    classifierVersion: CLASSIFIER_VERSION,
    facets: [...facets],
    entities: candidates.length ? [{ type: entityType, displayName, entityKey: normalizeEntityKey(displayName), confidence: Math.min(0.95, 0.55 + sortedSignals.length * 0.1) }] : [],
  };
}

/**
 * Just enough store for the demos: insert a row, patch it, remember a
 * dismissal. The real reference implementation, with all seven port methods, is
 * `src/adapters/inMemoryAdapter.ts`.
 */
export class InMemoryStore {
  constructor() {
    this.rows = new Map();
    this.dismissals = new Map();
    this.idCounter = 0;
  }
  insert(text, roomId = "r1") {
    const id = `row-${++this.idCounter}`;
    this.rows.set(id, { id, roomId, status: "queued", entityNames: [], updatedAt: Date.now() });
    return id;
  }
  async isEntityDismissed(roomId, entityNames) {
    const set = new Set((this.dismissals.get(roomId) ?? []).map((d) => d.entityName));
    return entityNames.some((n) => set.has(n.toLowerCase().trim()));
  }
  async recordDismissal(roomId, entityNames, by) {
    const existing = this.dismissals.get(roomId) ?? [];
    for (const name of entityNames) {
      existing.push({ roomId, entityName: name.toLowerCase().trim(), dismissedBy: by, dismissedAt: Date.now(), dismissCount: 1 });
    }
    this.dismissals.set(roomId, existing);
  }
  async patchRow(id, patch) {
    const row = this.rows.get(id);
    if (!row) return;
    Object.assign(row, patch);
    if (patch.finding) row.entityNames = patch.finding.entities.map((e) => e.displayName);
  }
}

/**
 * Demo activity stream. DEMO_EVENTS[0] is the original CLI fixture and the
 * CLI checks run against it unchanged; the rest give the graph rail a
 * realistic multi-event stream through the same classifier.
 */
export const DEMO_EVENTS = [
  "Met with CardioNova last week. They just raised Series A and are piloting at three hospitals. Need to follow up on their runway.",
  "Met the founder of Glia Therapeutics about their burn rate; ask for the pricing deck. https://gliatx.example/deck",
  "Meridian Capital announced a new healthcare fund. Research their recent pilot customers and confirm the source.",
  "lunch tomorrow, nothing noteworthy — just personal errands.",
];
