/**
 * NodeMem live graph rail — the CLI demo's pipeline rendered by NodeGraph Live.
 *
 * Honest contract, enforced here and asserted by scripts/capture-graph-rail.mjs:
 * - noticed entity  -> session.observe([entity], undefined)   (unknown count, dim node)
 * - suggestion      -> NO graph mutation at all
 * - human Confirm   -> session.observe([a, b], undefined)     (traversal edge — a hop, not a measurement)
 * - dismissal       -> store.recordDismissal only; the graph does not change
 * - assertEdge      -> never called; NodeMem has no versioned curated source
 */

import React, { useSyncExternalStore } from "react";
import { createRoot } from "react-dom/client";
import { GraphSession } from "../../vendor/nodegraph-live/index.js";
import { NodeGraph } from "../../vendor/nodegraph-live/react.js";
import { classifyNoteworthy, InMemoryStore, DEMO_EVENTS } from "../nodeMemDemoCore.mjs";

const ROOM = "r1";
const session = new GraphSession({ maxNodes: 200, maxEdges: 400, maxSeen: 1000 });
const store = new InMemoryStore();

const logEl = document.getElementById("log");
document.getElementById("boot-status")?.remove(); // the imports resolved; drop the loading row
const sugEl = document.getElementById("suggestions");
const log = (kind, text) => {
  const line = document.createElement("div");
  const k = document.createElement("span");
  k.className = "k";
  k.textContent = kind;
  line.appendChild(k);
  line.appendChild(document.createTextNode(text));
  logEl.appendChild(line);
  logEl.scrollTop = logEl.scrollHeight;
};

const entityRef = (e) => ({ kind: e.type, label: e.displayName });

function renderSuggestion(s) {
  const card = document.createElement("div");
  card.className = "suggestion";
  card.dataset.testid = "suggestion";
  const head = document.createElement("strong");
  head.textContent = `${s.a.label} ↔ ${s.b.label}`;
  const why = document.createElement("span");
  why.className = "why";
  why.textContent = `noticed together in one event (${s.action}, score ${s.score.toFixed(2)}) — a suggestion, not an edge`;
  const row = document.createElement("div");
  row.className = "row";
  const confirm = document.createElement("button");
  confirm.textContent = "Confirm";
  confirm.dataset.testid = "confirm-suggestion";
  const dismiss = document.createElement("button");
  dismiss.textContent = "Dismiss";
  dismiss.dataset.testid = "dismiss-suggestion";
  const resolve = (label) => {
    card.classList.add("resolved");
    row.remove();
    const state = document.createElement("div");
    state.className = "state";
    state.textContent = label;
    card.appendChild(state);
  };
  confirm.addEventListener("click", () => {
    session.observe([s.a, s.b], undefined, { eventId: `confirmed:${s.id}` });
    log("confirmed", `${s.a.label} ↔ ${s.b.label} — traversal edge drawn (a confirmed hop, still not a measured count)`);
    resolve("confirmed — drawn as faint traversal history");
  });
  dismiss.addEventListener("click", async () => {
    await store.recordDismissal(ROOM, [s.a.label], "human");
    log("dismissed", `${s.a.label} — recorded for dismissal learning; the graph did not change`);
    resolve("dismissed — nothing changed");
  });
  row.appendChild(confirm);
  row.appendChild(dismiss);
  card.appendChild(head);
  card.appendChild(why);
  card.appendChild(row);
  sugEl.appendChild(card);
}

async function runPipeline() {
  let n = 0;
  for (const text of DEMO_EVENTS) {
    n += 1;
    const rowId = store.insert(text, ROOM);
    const finding = classifyNoteworthy(text);
    if (finding.action === "ignore" || finding.entities.length === 0) {
      log("ignored", `event ${n}: "${text.slice(0, 60)}…" — below the noteworthy bar`);
      continue;
    }
    await store.patchRow(rowId, { status: "noteworthy", finding });
    for (const e of finding.entities) {
      session.observe([entityRef(e)], undefined, { eventId: `notice:${rowId}:${e.entityKey}` });
      log("noticed", `${e.displayName} (${e.type}) — unknown count, present and dim; noticing is never evidence`);
    }
    const primary = finding.entities[0];
    const facet = finding.facets[0];
    if (facet && !(await store.isEntityDismissed(ROOM, [primary.displayName]))) {
      renderSuggestion({
        id: `${rowId}:${primary.entityKey}:${facet}`,
        a: entityRef(primary),
        b: { kind: "facet", label: facet },
        action: finding.action,
        score: finding.score,
      });
      log("suggested", `${primary.displayName} ↔ ${facet} — waiting for a human; no edge drawn`);
    }
    await new Promise((r) => setTimeout(r, 300));
  }
  window.__graphRail.pipelineDone = true;
}

function App() {
  const snap = useSyncExternalStore(session.subscribe, session.getSnapshot);
  return React.createElement(NodeGraph, {
    nodes: snap.nodes,
    edges: snap.edges,
    visits: session.visitsById(),
    dark: true,
    height: 620,
  });
}

window.__graphRail = { session, pipelineDone: false };
createRoot(document.getElementById("root")).render(React.createElement(App));
runPipeline();
