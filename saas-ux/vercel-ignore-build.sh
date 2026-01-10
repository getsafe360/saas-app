#!/bin/bash

# This script determines whether Vercel should build or skip deployment
# Exit code 0 = deploy, Exit code 1 = skip deployment

# Skip deployment if commit message contains [skip deploy] or [skip ci]
COMMIT_MSG=$(git log -1 --pretty=%B)
if [[ "$COMMIT_MSG" =~ \[skip\ deploy\]|\[skip\ ci\]|\[no\ deploy\] ]]; then
  echo "🚫 Skipping deployment: Commit message contains skip flag"
  exit 1
fi

# Skip deployment for branches starting with "claude/" (AI-generated branches)
BRANCH_NAME=$(git rev-parse --abbrev-ref HEAD)
if [[ "$BRANCH_NAME" =~ ^claude/.* ]]; then
  echo "🚫 Skipping deployment: Branch is a Claude working branch"
  exit 1
fi

# Skip deployment if only specific files changed (e.g., docs, tests)
CHANGED_FILES=$(git diff --name-only HEAD~1)
if echo "$CHANGED_FILES" | grep -qvE '(README\.md|\.github|docs\/|\.md$)'; then
  echo "✅ Deploying: Code changes detected"
  exit 0
else
  echo "🚫 Skipping deployment: Only documentation changed"
  exit 1
fi
