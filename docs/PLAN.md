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

Partly blocked by: the upstream VaultMate PR replacing `DateTime.now()` with
`package:clock`, so tests can pin "today" (fork issue betztek/vaultmate#2). Only
`toggle` and `set-status` cases depend on it; `parse` and `serialize-roundtrip`
never read the clock and can be built first. Counts (VaultMate `main` @ a38724f):
34 calls in `lib/`, 11 in `lib/src/core/tasks`. Two matter for parity: the ➕
created date of a next occurrence (`task_manager.dart`) and the ✅ done date, which
is set in the UI layer (`InboxTasksCubit.changeTaskStatus`), not in `TaskManager`.

Tracking issues in the fork: consumer test betztek/vaultmate#3 (holds the
operation → VaultMate call mapping), golden sync #4, fork CI #5, widget #6.

### VaultMate behaviour seen in code (unverified by tests)

From reading VaultMate `main` @ a38724f. Expect most cases, including all three
seed cases, to start in `expected-divergences.json`:

- The global filter is stripped on parse and re-appended **after** the
  description on save (`#task Foo` → `Foo #task`); other tags are moved after it.
- Field order on save: priority, ➕, ✅, ❌, 📅, 🛫, ⏳, 🔁 (Tasks: priority, 🔁, ➕,
  🛫, ⏳, 📅, ❌, ✅).
- In Markdown files every non-space checkbox char parses as done: `[-]` and `[/]`
  are read as done and written back as `[x]`.
- Recurrence only when ⏳ is set, computed from ⏳ only; 📅/🛫 dropped from the next
  occurrence; ➕ always added. So `toggle-done-recurring-weekly-global-filter`
  (📅 only) gets **no** next occurrence in-app.
- No ❌ on cancel; no list marker other than `-`; no 🏁 🆔 ⛔ or block links.

Work happens in the user's VaultMate fork on `feat/parity-tests`, cut from
**upstream** `main` (so the eventual PR is clean).

Exit criteria:
- [ ] Clock PR open upstream (merged ideally; else `feat/parity-tests` is based on it).
- [ ] `test/parity/parity-cases.json` copied from a tagged commit here; source commit recorded (e.g. `test/parity/SOURCE`).
- [ ] `test/parity/parity_test.dart`: one `test()` per case, named by case id; pins clock via `withClock`; maps operations to VaultMate calls; compares `expected.lines` (primary) and modelled fields (secondary).
- [ ] `test/parity/expected-divergences.json` implemented with strict semantics (CASE-FORMAT.md §5).
- [ ] `flutter test test/parity` green, with every failing case listed as a known divergence (each with its own VaultMate issue).
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

1. **Which VaultMate code path is the "toggle" oracle for?** Confirmed: three
   different paths. In-app checkbox/swipe: `InboxTasksCubit.changeTaskStatus` sets
   ✅, then `TaskManager.setStatus` adds the next occurrence; this is what the
   Dart test maps `toggle` to. Edit dialog: `TaskEditorCubit.setStatus` changes
   status only (no ✅, no next occurrence). Widget: Kotlin (`TaskWrapper`), not
   reachable from Dart tests (betztek/vaultmate#6). Open: test through the cubit,
   or move the done-date logic into `TaskManager` first (betztek/vaultmate#2).
2. **Global filter in `tags` and `description`.** Answered for `tags`:
   VaultMate strips the filter before parsing, so its `tags` excludes it, like
   Tasks (VaultMate stores tags without `#`). Not comparable as-is:
   `description`. Tasks' includes the filter and all tags; VaultMate's excludes
   both. Compare after normalising, or skip `description`.
3. **Recurrence text normalisation.** Tasks rewrites the rule text via rrule
   (`every week on Monday` style). If VaultMate preserves user text verbatim,
   lines diverge on otherwise-correct behaviour. Decide: divergence, or fix
   VaultMate to normalise? VaultMate keeps the text verbatim, and its
   rule support is narrower than a normalisation issue: `every 2 weeks` throws
   (it expects `every week 2`), `every month` from Jan 31 overflows into March,
   `when done` and `every week on Monday` are unsupported.
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
9. **Issue #63 details** were taken from the user's brief. VaultMate's widget
   code since read: it rebuilds the next line from already-parsed fields
   (filter stripped), drops 📅/🛫 and needs ⏳, consistent with #63. The issue
   text itself is still unread.
10. **Settings VaultMate can't express.** Only `globalFilter` maps directly;
    `recurrenceOnNextLine` matches only at its default (next occurrence above).
    VaultMate has no option for `removeScheduledDateOnRecurrence`,
    `setCreatedDate` (always adds ➕), `setDoneDate` (always), `setCancelledDate`
    (never writes ❌), `removeGlobalFilter`, or `taskFormat` (auto-detects
    Dataview per line). CASE-FORMAT §5 has no "skipped: unsupported setting"
    outcome. Decide before cases with non-default values land: list them as
    divergences (recommended; keeps the gap visible) or add a skip outcome.
