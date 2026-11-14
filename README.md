# tasks-parity

Golden test data proving that [VaultMate](https://github.com/Vankir/vaultmate)
(Flutter/Dart Android app) reads and writes task lines the same way the
[Obsidian Tasks plugin](https://github.com/obsidian-tasks-group/obsidian-tasks)
does.

## Why

VaultMate re-implements Tasks' behaviour (parsing, serialisation, toggling,
recurrence) independently, and the two drift. Example: VaultMate issue #63,
completing a recurring task from the widget drops the global filter tag (`#task`)
from the next occurrence; Tasks keeps it.

Comparing the two by reading code doesn't scale. This repo is an **oracle**: it
runs the **real** upstream Tasks code, pinned to a release, against hand-written
case inputs, and writes the results as language-neutral JSON. VaultMate's test
suite consumes that JSON. Only the JSON crosses repos.

```
cases/*.json ──► yarn generate ──► out/parity-cases.json ──copy──► VaultMate fork: test/parity/
 (inputs)       (real Tasks code,      (goldens, committed)           Dart test + expected-divergences.json
                 vendor/obsidian-tasks
                 @ release tag)
```

## Layout

| Path | What |
|---|---|
| `vendor/obsidian-tasks/` | Upstream Tasks, git submodule pinned to a **release tag** (currently 8.6.0). Never edited. |
| `cases/*.json` | Case inputs. Format: [docs/CASE-FORMAT.md](docs/CASE-FORMAT.md). |
| `out/parity-cases.json` | Generated goldens. Committed. Never hand-edited. |
| `generator/` | Loads cases, runs them through Tasks, writes goldens. |
| `tests/` | Unit tests for the generator itself. |
| `docs/PLAN.md` | Phases, exit criteria, open questions. |
| `CLAUDE.md` | Rules and procedures for Claude Code sessions (useful for humans too). |

## Setup

```sh
git clone --recurse-submodules https://github.com/betztek/Tasks-parity
cd Tasks-parity
./setup.sh      # submodule init, yarn install inside vendor/, node_modules symlink
```

Requires Node ≥ 22.12 and yarn 1.x. This repo has no dependencies of its own:
`node_modules` is a symlink to `vendor/obsidian-tasks/node_modules`, so the
generator uses exactly the toolchain upstream's `yarn.lock` pins (Vitest, moment,
...). `setup.sh` is idempotent and runs automatically at Claude Code session start.

## Regenerate goldens

```sh
yarn test        # generator unit tests
yarn generate    # writes out/parity-cases.json
git diff out/    # review: every change must be explainable
```

Generation runs inside Vitest because that is how Tasks code runs outside
Obsidian: upstream's `obsidian` mock, setup files and `TZ=UTC` global setup are
reused (see `vitest.config.ts`; `tests/config.test.ts` fails if upstream's config
drifts). The clock is pinned per case with fake timers, so output is
deterministic.

## Add a case

1. Add an entry to a file in `cases/` (see [CASE-FORMAT.md](docs/CASE-FORMAT.md)).
2. `yarn generate`, then read the diff of `out/parity-cases.json`.
3. Commit the case and the regenerated goldens together.

## How VaultMate consumes the goldens

In the VaultMate fork (branch `feat/parity-tests`, see [PLAN.md](docs/PLAN.md) P2):

- `test/parity/parity-cases.json`: a copy of `out/parity-cases.json` from a
  specific commit of this repo (the commit is recorded alongside it).
- `test/parity/expected-divergences.json`: case ids VaultMate is known to fail,
  each with a reason and issue link.
- A Dart test that, for each case: pins the clock to `today` (via `package:clock`,
  which needs the upstream clock PR), applies the settings, runs the equivalent
  VaultMate operation on `input.lines`, and compares to `expected.lines`
  (primary) and the parsed fields VaultMate models (secondary). Listed divergences
  are expected to fail; a listed case that passes fails the suite so the list
  shrinks as fixes land.

## License

MIT (see `LICENSE`). Tasks is MIT. VaultMate is GPL-3; it only consumes the JSON
data produced here.
