#!/usr/bin/env bash
# Create a worktree under .worktrees/<name>, copy .env.local, install deps.
# Usage: scripts/worktree-dev.sh <worktree-name> [base-branch]
#   scripts/worktree-dev.sh avatar-hero            # branches off main
#   scripts/worktree-dev.sh fix-foo origin/develop # branches off origin/develop
set -euo pipefail

if [[ $# -lt 1 ]]; then
  echo "usage: $0 <worktree-name> [base-branch]" >&2
  exit 1
fi

name="$1"
base="${2:-main}"
root="$(git rev-parse --show-toplevel)"
branch="feature/$name"
path="$root/.worktrees/$name"

if [[ -d "$path" ]]; then
  echo "worktree already exists: $path" >&2
  exit 1
fi

git -C "$root" worktree add "$path" -b "$branch" "$base"

if [[ -f "$root/.env.local" ]]; then
  cp "$root/.env.local" "$path/.env.local"
  echo "copied .env.local"
else
  echo "note: $root/.env.local not found — dev server may fail without env"
fi

(cd "$path" && npm install --silent)

echo ""
echo "ready: $path"
echo "next:  cd $path && npm run dev"
