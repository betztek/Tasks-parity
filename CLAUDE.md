# CLAUDE.md

Oracle repo: runs **real** Obsidian Tasks code (submodule `vendor/obsidian-tasks`,
pinned to a release tag) on case inputs in `cases/*.json` and writes goldens to
`out/parity-cases.json`, consumed by a Dart test in the user's VaultMate fork.
Read `README.md`, `docs/PLAN.md` (current phase, open questions) and
`docs/CASE-FORMAT.md` (schema) before non-trivial work.

## Hard rules

1. **Never edit `out/parity-cases.json` by hand.** Always `yarn generate`. If a
   golden looks wrong, the fix is in the case input, the generator, or the pin.
2. **Never modify the submodule.** No edits, patches, or commits inside
   `vendor/obsidian-tasks`. The only allowed change is moving the pin to another
   **release tag** (see "Bump Tasks version"). Never pin to `main` or a branch.
3. **Oracle output comes from real Tasks code only.** The generator may set up
   state (settings, global filter, clock) and extract fields from Tasks objects.
   It must never compute dates, statuses, recurrence or serialisation itself. If
   something can't be done with an upstream entry point, stop and ask.
4. **Red-green TDD for generator code** (`generator/`): write the test first, run
   `yarn test`, **show the user the red output**, then implement until green.
   Stub new modules (throwing "not implemented") so the red run fails on
   assertions, not imports.
5. **Case ids are permanent.** Never rename or reuse an id; VaultMate's
   `expected-divergences.json` refers to them. Retire a case by deleting it and
   noting it in the commit message.
6. **Keep changes scoped** to what was asked. No drive-by refactors.
7. **Plan first for non-trivial work** (new operation, schema change, version
   bump, anything touching > 2 files): state the plan, get a go-ahead.
8. **When the user corrects you, propose a CLAUDE.md update** capturing the
   lesson so the next session doesn't repeat it.
9. Don't touch the VaultMate fork from a session unless the task says so.
10. Small logical commits. Commit case inputs and their regenerated goldens together.

## Environment

- Cloud environment `tasks-parity`: Node 22 + yarn (base image), Flutter 3.44.7
  at `/opt/flutter` (setup script, for sessions that also attach the VaultMate fork).
- `./setup.sh` (idempotent): submodule init, `yarn install --frozen-lockfile` in
  the submodule (skipped if `yarn.lock` unchanged), `node_modules` symlink to the
  submodule's. Runs from the SessionStart hook in `.claude/settings.json`.
- **Hooks don't run in multi-repo sessions** (e.g. this repo + the VaultMate
  fork): run `./setup.sh` manually first.
- This repo has no npm dependencies of its own, on purpose. Don't add a
  `yarn.lock` or install packages here; that would create a second copy of
  moment/vitest that diverges from what Tasks tests with.

## Commands

| Command | What |
|---|---|
| `./setup.sh` | Prepare the checkout (idempotent, ~0.1 s when done) |
| `yarn test` | Generator unit tests + config drift guard |
| `yarn generate` | Regenerate `out/parity-cases.json` |
| `yarn typecheck` | `tsc --noEmit` over generator and tests |

## How the generator works (orientation)

- `vitest.config.ts` mirrors upstream's (obsidian mock alias, setup files,
  `TZ=UTC` global setup). `tests/config.test.ts` fails on upstream drift.
- `generator/runCase.ts`: per case, `resetSettings()` + `updateSettings()`,
  mirror `globalFilter`/`removeGlobalFilter` into the `GlobalFilter` singleton
  (as `src/main.ts` does), reset `StatusRegistry`, pin the clock with
  `vi.setSystemTime(today 12:00)`, call the upstream entry point.
- Why fake timers and not just the `today` argument: `Task.toggle()` takes no
  date, and `createNextOccurrence` reads `window.moment()` for the created date
  regardless of `today`.
- Upstream entry points: `parse` → `Task.fromLine`; `serialize-roundtrip` →
  `toFileLineString`; `toggle` → `toggleLine` (Commands/ToggleDone.ts);
  `set-status` → `handleNewStatusWithRecurrenceInUsersOrder`.

## Procedures

### Regenerate goldens

1. `./setup.sh` (confirm it prints the expected tag).
2. `yarn test` must be green.
3. `yarn generate`.
4. `git diff --stat out/` and read the diff. Every changed case must be explained
   by a case-input change or generator change in the same commit.
5. Re-run `yarn generate`; the second run must produce no diff (determinism).
6. Commit inputs + goldens together.

### Bump Tasks version

1. Find the latest release: `git -C vendor/obsidian-tasks fetch --tags` then
   `git -C vendor/obsidian-tasks tag --sort=-v:refname | grep -E '^[0-9]+\.[0-9]+\.[0-9]+$' | head`.
   Use release tags only (upstream also has non-release tags like `3631-start`).
2. `git -C vendor/obsidian-tasks checkout <tag>`.
3. `./setup.sh` (reinstalls deps if `yarn.lock` changed).
4. `yarn test`: if `tests/config.test.ts` fails, re-mirror upstream's
   `vitest.config.ts` into ours. Fix any generator breakage from upstream API changes
   (red-green as usual).
5. `yarn generate`, then diff `out/parity-cases.json`.
6. Summarise for the user: per changed case id, old vs new expected line(s), and
   **why**, citing the upstream commit/PR/changelog entry
   (`git -C vendor/obsidian-tasks log <old>..<new> -- src/`). Unexplained changes
   are a stop-and-ask.
7. Commit: `git add vendor/obsidian-tasks out/` with message
   `Bump Tasks <old> -> <new>` and the summary in the body.
8. Update the pinned version in README.md / PLAN.md if mentioned.

### Add cases

Follow README "Add a case". Pick the case file by theme; ids per CASE-FORMAT.md.
A case that exposes a VaultMate bug is still just a case here; the divergence
entry and issue live in the VaultMate fork.
