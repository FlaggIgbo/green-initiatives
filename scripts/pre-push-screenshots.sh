#!/bin/sh
set -e

if [ "$SKIP_SCREENSHOTS" = "1" ] || [ "$SKIP_SCREENSHOTS" = "true" ]; then
  echo "⏭️ SKIP_SCREENSHOTS is set; skipping screenshot check."
  exit 0
fi

changed=$(git diff --name-only HEAD~1..HEAD 2>/dev/null | grep -E '^(client/src/|shared/|scripts/generate-screenshots)' | grep -v '^screenshots/' || true)
uncommitted=$(git status --porcelain client/src/ shared/ 2>/dev/null | grep -v 'screenshots/' || true)

if [ -z "$changed" ] && [ -z "$uncommitted" ]; then
  echo "✅ No frontend changes detected. Skipping screenshot regeneration."
  exit 0
fi

echo "📸 Regenerating screenshots with Playwright..."
npm run screenshots

if [ -n "$(git status --porcelain screenshots/ 2>/dev/null || true)" ]; then
  git add screenshots/
  git commit --no-verify -m "chore(screenshots): regenerate screenshots"
  echo "⚠️  Screenshots updated and committed. Please run 'git push' again."
  exit 1
fi
