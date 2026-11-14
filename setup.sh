#!/usr/bin/env bash
# Per-repo setup for tasks-parity. Idempotent: skips work already done.
# Runs automatically via the SessionStart hook in .claude/settings.json.
# In multi-repo cloud sessions hooks do not run: execute ./setup.sh manually.
set -euo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")"

VENDOR=vendor/obsidian-tasks

# 1. Submodule: init / move to the commit recorded in this repo (never to a branch tip).
#    `git submodule status` prefixes '-' (not initialised) or '+' (checked-out commit differs).
status="$(git submodule status -- "$VENDOR" 2>/dev/null || true)"
case "$status" in
  -*|"") echo "setup: initialising $VENDOR"; git submodule update --init -- "$VENDOR" ;;
  +*)    echo "setup: WARNING $VENDOR is not at the pinned commit; leaving it alone." >&2
         echo "setup:   run 'git submodule update -- $VENDOR' to reset, or commit the new pin." >&2 ;;
  *)     : ;;
esac

# 2. Upstream dependencies, from upstream's own lockfile. Re-run only when yarn.lock changes.
stamp="$VENDOR/node_modules/.tasks-parity-lock.sha"
want="$(sha256sum "$VENDOR/yarn.lock" | cut -d' ' -f1)"
if [ ! -f "$stamp" ] || [ "$(cat "$stamp")" != "$want" ]; then
  echo "setup: yarn install in $VENDOR"
  (cd "$VENDOR" && yarn install --frozen-lockfile --silent --non-interactive)
  echo "$want" > "$stamp"
fi

# 3. This repo has no dependencies of its own: it reuses upstream's node_modules so the
#    generator runs on exactly the toolchain (vitest, moment, ...) Tasks tests with.
if [ ! -L node_modules ]; then
  rm -rf node_modules
  ln -s "$VENDOR/node_modules" node_modules
fi

echo "setup: ok ($(cd "$VENDOR" && git describe --tags --always))"
