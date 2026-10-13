#!/bin/bash

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "${VAULT:-$ROOT/vault}" || exit 1

scratch="$ROOT/artifacts/vault"
mkdir -p "$scratch"

count=0

find . -name "*.md" -type f | while read -r file; do
  if ! grep -q '\[\[self\]\]' "$file" 2>/dev/null; then
    continue
  fi

  if ! grep -q "cardlink\|Source URL::" "$file" 2>/dev/null; then
    continue
  fi

  url=$(grep -A1 "^\`\`\`cardlink" "$file" 2>/dev/null | grep "^url:" | head -1 | sed 's/url: //' | tr -d ' ')

  if [ -z "$url" ]; then
    url=$(grep "Source URL::" "$file" 2>/dev/null | head -1 | sed 's/Source URL:: //' | tr -d ' ')
  fi

  if [ -n "$url" ] && [ "$url" != "" ]; then
    host=$(echo "$url" | sed -E 's|https?://||' | sed -E 's|/.*||' | sed 's/www\.//')

    domain=$(echo "$host" | cut -d'.' -f1)

    author=$(echo "$domain" | awk '{print toupper(substr($0,1,1)) tolower(substr($0,2))}')

    cat > "$scratch/new_frontmatter.txt" << EOF
---
title: "$(basename "$file" .md)"
source: "${url}"
author:
  - "[[${author}]]"
published:
created: $(grep "created:" "$file" | head -1 | sed 's/created: //')
description: ""
tags:
  - "reference"
---

EOF

    tail -n +$(grep -n "^---$" "$file" | tail -1 | cut -d: -f1) "$file" | tail -n +2 > "$scratch/body.txt" 2>/dev/null

    cat "$scratch/new_frontmatter.txt" "$scratch/body.txt" > "$scratch/fixed_file.md"
    mv "$scratch/fixed_file.md" "$file"

    count=$((count + 1))
    if [ $((count % 50)) -eq 0 ]; then
      echo "Fixed $count files..."
    fi
  fi
done

echo "✓ Fixed $count files total"
