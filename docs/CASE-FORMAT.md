# Case format

Three JSON files are involved:

| File | Lives in | Written by | Purpose |
|---|---|---|---|
| `cases/*.json` | this repo | humans / Claude | Case **inputs**: line(s), operation, today, settings |
| `out/parity-cases.json` | this repo | `yarn generate` only | **Goldens**: inputs + resolved settings + Tasks' expected output |
| `expected-divergences.json` | VaultMate fork | humans / Claude | Case ids VaultMate is known to fail, with reason and issue link |

Only `out/parity-cases.json` crosses repos. The generator implementation is
`generator/caseFile.ts` (input validation) and `generator/runCase.ts` (execution);
keep this document in sync with them.

All dates are calendar dates, `YYYY-MM-DD`, with no time or zone. The generator
runs Tasks with `TZ=UTC` (upstream's own test setup) and the clock pinned to noon
on `today`.

## 1. Input: `cases/*.json`

Each file holds an object with a `cases` array. Files are grouped by theme
(`seed.json`, `recurrence-month-end.json`, ...); the grouping has no meaning to
consumers.

```json
{
  "cases": [
    {
      "id": "toggle-done-recurring-weekly-global-filter",
      "description": "Toggle a weekly recurring task carrying the global filter tag ...",
      "operation": "toggle",
      "today": "2026-11-14",
      "settings": { "globalFilter": "#task" },
      "input": { "lines": ["- [ ] #task Water the plants 🔁 every week 📅 2026-11-14"] },
      "links": ["https://github.com/Vankir/vaultmate/issues/63"]
    }
  ]
}
```

| Field | Required | Type | Rules |
|---|---|---|---|
| `id` | yes | string | kebab-case `[a-z0-9-]`, unique across **all** files, **never reused or renamed** once committed (VaultMate's divergence list refers to it). Convention: `<operation>-<topic>-<variant>`. |
| `description` | yes | string | What the case proves, in one or two sentences. |
| `operation` | yes | enum | `parse` \| `serialize-roundtrip` \| `toggle` \| `set-status` (see §3). |
| `today` | yes | `YYYY-MM-DD` | The pinned "today" for done/cancelled/created dates and recurrence. |
| `settings` | no | object | Overrides of Tasks settings (§2). Omitted keys use Tasks' defaults. |
| `input.lines` | yes | string[] | Markdown lines, exactly as in a vault file. `toggle` and `set-status` take exactly one line. |
| `input.newStatusSymbol` | `set-status` only | 1-char string | Target status symbol, e.g. `"x"`, `"-"`, `"/"`, `" "`. |
| `links` | no | string[] | Related issues/PRs/docs. Informational. |

Unknown settings keys are rejected (typo protection).

## 2. Settings

Inputs may override any of these. Outputs always carry **all** of them, resolved,
so a consumer never needs to know Tasks' defaults.

| Key | Tasks default | Meaning |
|---|---|---|
| `globalFilter` | `""` | Only lines containing this string are tasks. The user's vault: `"#task"`. |
| `removeGlobalFilter` | `false` | Hide the global filter when *rendering*. Does not change file contents. |
| `taskFormat` | `"tasksPluginEmoji"` | `"tasksPluginEmoji"` or `"dataview"`. P1–P3 use emoji only. |
| `recurrenceOnNextLine` | `false` | `false`: next occurrence written **above** the completed task; `true`: below. |
| `removeScheduledDateOnRecurrence` | `false` | Drop ⏳ from the next occurrence. |
| `setCreatedDate` | `false` | Add ➕ today to new occurrences. |
| `setDoneDate` | `true` | Add ✅ today on completion. |
| `setCancelledDate` | `true` | Add ❌ today on cancellation. |

Custom statuses are not configurable yet; every case uses Tasks' default status
registry (` `, `x`, `/`, `-`, plus Tasks' rules for unknown symbols). See PLAN.md
open questions.

## 3. Operations

Each operation calls the upstream entry point a real user action goes through.

| Operation | Upstream call | `expected.lines` | `expected.tasks` |
|---|---|---|---|
| `parse` | `Task.fromLine` per input line | absent | one entry per input line |
| `serialize-roundtrip` | `Task.fromLine(...).toFileLineString()` per line; non-task lines pass through unchanged | one per input line | parse of each **input** line |
| `toggle` | `toggleLine` from `src/Commands/ToggleDone.ts` (the *Tasks: Toggle task done* command; checkbox clicks use the same `Task.toggleWithRecurrenceInUsersOrder()`) | the resulting file lines, in file order (1 or 2) | `Task.fromLine` of each **resulting** line |
| `set-status` | `Task.handleNewStatusWithRecurrenceInUsersOrder(status, today)` with `status = StatusRegistry.bySymbolOrCreate(newStatusSymbol)` | resulting lines in file order; input unchanged if it is not a task | the resulting Task objects |

Notes:

- `toggle` on a line that is not a Task (e.g. missing the global filter) still
  produces output: Tasks falls back to a plain checkbox toggle with no done date.
  `expected.tasks` is then `[null]`. This is deliberate parity territory.
- Recurrence ordering honours `recurrenceOnNextLine` and `🏁` on-completion
  actions (`delete` removes the completed line).

## 4. Output: `out/parity-cases.json`

```json
{
  "schema_version": 1,
  "tasks_version": "8.6.0",
  "tasks_commit": "d37646b67cae0329234e73cbd3478661da2383af",
  "cases": [ { "...input fields...", "settings": { "...all 8 keys..." }, "expected": { ... } } ]
}
```

| Field | Meaning |
|---|---|
| `schema_version` | Bumped on any breaking change to this format. Consumers must refuse unknown versions. |
| `tasks_version` | `version` from the submodule's `package.json` (= the release tag). |
| `tasks_commit` | Submodule commit SHA. |
| `cases` | Sorted by `id`. Each case echoes its input fields (`id`, `description`, `operation`, `today`, `input`, `links`), replaces `settings` with the fully resolved settings, and adds `expected`. |

No timestamps or machine-specific data: regenerating with the same pin and the
same inputs is byte-identical.

### `expected.tasks[i]`: parsed task fields

`null` if the line is not a Task under the case's settings. Otherwise:

```json
{
  "indentation": "",
  "listMarker": "-",
  "status": { "symbol": "x", "name": "Done", "type": "DONE", "nextStatusSymbol": " " },
  "description": "#task Water the plants",
  "priority": "none",
  "dates": { "created": null, "start": null, "scheduled": null,
             "due": "2026-11-14", "done": "2026-11-14", "cancelled": null },
  "scheduledDateIsInferred": false,
  "recurrence": "every week",
  "onCompletion": "",
  "id": "",
  "dependsOn": [],
  "tags": [],
  "blockLink": ""
}
```

| Field | Notes |
|---|---|
| `status.type` | `TODO` \| `DONE` \| `IN_PROGRESS` \| `CANCELLED` \| `NON_TASK` \| `ON_HOLD` \| `EMPTY` |
| `description` | Text left after Tasks strips the emoji fields. **Includes the global filter** (it is not removed from the file). |
| `priority` | `highest` \| `high` \| `medium` \| `none` \| `low` \| `lowest` |
| `recurrence` | Tasks' normalised rule text (`Recurrence.toText()`), including `when done`. May differ from what the user typed; the serialised line uses this text too. |
| `onCompletion` | `""` \| `keep` \| `delete` |
| `tags` | Tags Tasks extracted from the description. **Excludes the global filter** when it is a tag (Tasks behaviour, see the seed goldens). |
| `scheduledDateIsInferred` | Always `false` here: filename-as-scheduled-date is not exercised. |

**Primary contract for consumers is `expected.lines`.** Fields are secondary:
compare only fields VaultMate's model actually has, and say which in the Dart test.

## 5. `expected-divergences.json` (lives in the VaultMate fork)

Location: `test/parity/expected-divergences.json` next to the Dart consumer test
and its vendored copy of `parity-cases.json`. It lives there because it describes
VaultMate's state and changes with VaultMate fixes, not with Tasks.

```json
{
  "divergences": [
    {
      "id": "toggle-done-recurring-weekly-global-filter",
      "reason": "Completing from the widget drops the global filter tag on the next occurrence.",
      "issue": "https://github.com/Vankir/vaultmate/issues/63"
    }
  ]
}
```

| Field | Required | Meaning |
|---|---|---|
| `id` | yes | A case id from `parity-cases.json`. |
| `reason` | yes | One sentence: what VaultMate does differently. |
| `issue` | yes | Issue or PR URL tracking the fix. Open an issue first if none exists. |

Consumer rules (strict expected-failure, like pytest `xfail(strict=True)`):

| Case listed? | VaultMate result | Test outcome |
|---|---|---|
| no | matches | pass |
| no | differs | **fail** (new regression or new case exposing a bug) |
| yes | differs | pass, reported as "known divergence" with reason + issue |
| yes | matches | **fail**: "divergence fixed, remove `<id>` from expected-divergences.json" |
| id not in goldens | n/a | **fail**: stale or misspelled entry |

The last two rules keep the list honest: it can only shrink when fixes land, and
it cannot rot.
