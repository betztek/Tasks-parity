# Plan

Goal: an automated parity suite proving VaultMate handles Tasks-format task lines
the way Obsidian Tasks does, for the settings the user's vault uses (global filter
`#task`, emoji format), with known divergences tracked rather than hidden.

Status legend: ✅ done · 🟡 in progress · ⬜ not started

## P0: Docs, environment, submodule ✅

- Submodule `vendor/obsidian-tasks` pinned to the latest release tag (8.6.0).
- `setup.sh` (idempotent) + SessionStart hook; cloud environment `tasks-parity`
  with Flutter 3.44.7 in its setup script.
- README, PLAN, CASE-FORMAT, CLAUDE.md.

Exit criteria:
- [x] Fresh clone + `./setup.sh` gives a working `yarn test` (verified: ~16 s with warm yarn cache).
- [x] Submodule at a release tag, not `main`.
- [x] Docs describe how to regenerate goldens and how VaultMate consumes them.

## P1: Generator + ~20 seed cases, goldens committed 🟡

Scaffold done: generator, 3 seed cases, goldens. Remaining: ~17 more cases.

Exit criteria:
- [x] `yarn generate` produces `out/parity-cases.json` from real Tasks code only.
- [x] Generator unit-tested (`yarn test`), developed red-green.
- [x] Regeneration is deterministic (byte-identical on re-run).
- [ ] ~20 cases covering, at minimum: parse of every emoji field (➕ 🛫 ⏳ 📅 ✅ ❌ 🔁 🏁 🆔 ⛔ and all 5 priorities);
      serialize-roundtrip field order; toggle done/undone; set-status to `-`, `/`, ` `;
      global filter present/absent; recurring daily/weekly/monthly; `recurrenceOnNextLine` true/false.
- [ ] Each case id follows the naming convention; descriptions say what is proven.
- [ ] A `yarn check` (generate to memory, diff against committed goldens, non-zero exit on drift) so staleness is detectable. Needed by P4; cheap now.
- [ ] Tagged release of this repo (e.g. `goldens-v1`) that P2 can pin to.

## P2: Dart consumer test in the VaultMate fork ⬜

Blocked by: the upstream VaultMate PR replacing `DateTime.now()` (~34 calls) with
`package:clock`, so tests can pin "today". Without it, every date-dependent case
is untestable.

Work happens in the user's VaultMate fork on `feat/parity-tests`, cut from
**upstream** `main` (so the eventual PR is clean).

Exit criteria:
- [ ] Clock PR open upstream (merged ideally; else `feat/parity-tests` is based on it).
- [ ] `test/parity/parity-cases.json` copied from a tagged commit here; source commit recorded (e.g. `test/parity/SOURCE`).
- [ ] `test/parity/parity_test.dart`: one `test()` per case, named by case id; pins clock via `withClock`; maps operations to VaultMate calls; compares `expected.lines` (primary) and modelled fields (secondary).
- [ ] `test/parity/expected-divergences.json` implemented with strict semantics (CASE-FORMAT.md §5).
- [ ] `flutter test test/parity` green, with the #63 case listed as a known divergence.
- [ ] Refuses unknown `schema_version`.

## P3: Expand cases ⬜

Exit criteria: each area below has cases, goldens regenerated, divergences filed
in VaultMate with issues.

- Recurrence edge cases: month-end (`every month` from Jan 31; `every month on the last day`), `every N weekdays`, `when done` vs not, leap years (Feb 29 yearly / monthly), recurrence with only scheduled or only start date, multiple dates shifting together, `removeScheduledDateOnRecurrence`.
- Global filter: add/remove behaviour, filter absent from line, filter as nested tag (`#task/sub`), filter mid-description, `removeGlobalFilter` (render-only; confirm no file effect).
- Statuses: all default symbols, unknown symbols, cancel/uncancel dates, done → undone clears ✅.
- Serialization order: every field combination VaultMate can emit, trailing block links, `^id`, hard-break trailing spaces, indentation and `*`/`+`/numbered list markers.
- On-completion (`🏁 delete`/`keep`), created date on new occurrence.

## P4 (optional): CI regeneration on Tasks version bump ⬜

Exit criteria:
- [ ] GitHub Action on this repo: `./setup.sh && yarn test && yarn check` on every push.
- [ ] Scheduled job (weekly) that detects a new upstream release tag, opens a PR bumping the submodule, regenerates goldens, and puts the golden diff summary in the PR body.
- [ ] Not Dependabot's gitsubmodule updater: it tracks branch tips, not release tags.

## Open questions

1. **Which VaultMate code path is the "toggle" oracle for?** Widget completion,
   in-app checkbox and edit dialog may use different code. Each needs mapping to
   one Tasks operation; the widget likely maps to `toggle`.
2. **Global filter in `tags`.** Tasks excludes the global filter from `tags`.
   Does VaultMate's model have a tags field that includes it? If so compare
   `tags` minus the filter, or skip `tags`.
3. **Recurrence text normalisation.** Tasks rewrites the rule text via rrule
   (`every week on Monday` style). If VaultMate preserves user text verbatim,
   lines diverge on otherwise-correct behaviour. Decide: divergence, or fix
   VaultMate to normalise?
4. **Custom statuses.** The user's vault may define custom statuses in Tasks'
   `data.json`. Add a `statuses` setting to the case format when needed (would
   bump `schema_version` only if made required).
5. **Golden transport to VaultMate.** Proposed: copy + record source commit
   (no network in tests, explicit updates). Alternative: git submodule of this
   repo inside the fork, which upstream VaultMate is unlikely to accept.
6. **Upstreaming the parity tests.** Will VaultMate's maintainer accept a test
   suite whose data comes from an MIT repo? Likely fine (data, GPL-compatible),
   but ask before P2 is large.
7. **Version skew.** Which Tasks version does the user actually run in Obsidian?
   Goldens should match it, not necessarily the newest release.
8. **Timezone.** Goldens are generated under `TZ=UTC` at local noon. VaultMate
   runs on device-local time; date-only semantics should make this irrelevant,
   but a case around midnight/DST could confirm.
9. **Issue #63 details** were taken from the user's brief and not verified here
   (VaultMate repo not attached to this session).
