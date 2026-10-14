# Changelog

## 2026-10-07 — Passive memory ownership handoff

- Retained the unique NodeKit adoption map from PR #3 and linked it from the
  README documentation table.
- Resolved the old branch's command changes using main
  `cda87ab2a9562279c2c84801f3858022712324f4`: preserved the browser service,
  source-demo proof and current secret/type/test/proof check. Removed references
  to obsolete smoke aliases from the handoff.
- Disclosed schema-only Convex support, host-owned job approval/storage and the
  unimplemented canonical event adapter and certification receipt.
- This documentation refresh changes no classifier, runtime, dependencies or UI.
  It claims no measured pipeline improvement or new visual grade. Current-head
  automatic conformance is recorded on
  [PR #3](https://github.com/HomenShum/NodeMem/pull/3); this workflow does not run
  the application test suite or certify a live deployment.

## 2026-10-14 — Respect the room's quieter suggestion budget

A room owner asking for one suggestion could receive ten because the scanner
ignored the resolved numeric policy. The scan now applies the lower host and
room/system ceilings; zero withholds suggestions, and invalid limits reject
before a quota read or verdict write for an otherwise eligible scan. Real-store
scenarios cover budget order,
policy changes, malformed settings, degraded reads, interleaved rooms and a
zero-cap burst. Positive-cap same-room races, row replay and historical counting
remain separate storage-contract defects, explicitly documented. No classifier,
storage API, dependencies or browser-demo behavior changed.
