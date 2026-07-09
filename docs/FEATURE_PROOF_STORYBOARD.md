# NodeMem Feature Proof Storyboard

This storyboard governs the README media:

- `assets/noderoom-review-approve.gif`

The current clip is captured from NodeMem running inside NodeRoom. Until this repo ships its own browser showcase, `npm run clip:capture` verifies the checked-in GIF and writes a local proof receipt instead of fabricating a fresh capture.

## Proof Contract

The clip and README must prove five things:

1. **Passive scan** - NodeMem observes activity and detects entities without automatically starting jobs.
2. **Noteworthy suggestion** - the system surfaces a suggestion with enough context for a human to inspect it.
3. **Explicit approval** - research or write-side effects require a user approval step.
4. **Dismissal learning** - repeated or unwanted suggestions can be suppressed by policy and dismissal history.
5. **Provider-neutral storage** - Convex is one proof adapter, while the core `MemoryStore` contract remains backend-agnostic.

## Story Beats

1. **Activity enters the room** - a chat, note, spreadsheet row, or trace event mentions a company/person/topic.
2. **Memory notices** - NodeMem groups the entity and policy context into a suggestion.
3. **Review surface** - the user sees why the suggestion is noteworthy and what action would run.
4. **Approve or dismiss** - the action is explicit; dismissal becomes future ranking signal.
5. **Receipt handoff** - smoke receipts show the same path in deterministic code: full pipeline, in-memory adapter, and Convex schema validation.

## Capture Command

```bash
npm run clip:capture
```

The command validates the README GIF, records size and SHA-256 metadata, and writes `docs/eval/nodemem-storyboard-proof.json`. It should be run after changing README media or the storyboard.

## Validation Checklist

- `npm run nodemem:smoke`
- `npm run nodemem:in-memory:smoke`
- `npm run clip:capture`
- `npm run typecheck`
- `npm test`

Optional adapter check:

- `npm run nodemem:convex:smoke`

## Follow-Up Integration

- Add a small standalone browser/Streamlit memory explorer so the README GIF can be regenerated without depending on NodeRoom.
- Publish NodeMem tasks into NodeTasks: passive scan, duplicate suppression, dismissal learning, policy allow/deny, and Convex schema compatibility.
- Use NodeGraph to visualize memory clusters: entity, mention, suggestion, approval, dismissal, policy, and downstream job nodes.
