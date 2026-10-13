#!/bin/bash

set -euo pipefail
IFS=$'\n\t'

VAULT="${VAULT:-$(cd "$(dirname "$0")/../../vault" && pwd)}"
GITHUB_USER="${GITHUB_USER:-$(gh api user --jq .login 2>/dev/null)}"
[ -n "$GITHUB_USER" ] || { echo "Set GITHUB_USER or log in with gh" >&2; exit 1; }
DEFAULT_DIR="Resources/GitHub Stars"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

GREEN='\033[0;32m'
RED='\033[0;31m'
BLUE='\033[0;34m'
YELLOW='\033[0;33m'
NC='\033[0m'

determine_path() {
  local repo_json desc language name full_name
  repo_json=$(cat)
  desc=$(echo "$repo_json" | jq -r '.description // ""')
  language=$(echo "$repo_json" | jq -r '.language // ""')
  name=$(echo "$repo_json" | jq -r '.name // ""')
  full_name=$(echo "$repo_json" | jq -r '.full_name // ""')

  desc_has() {
    local word
    for word in "$@"; do
      if echo "$desc" | grep -qi "$word"; then return 0; fi
    done
    return 1
  }

  has_topic() {
    local topic
    for topic in "$@"; do
      if echo "$repo_json" | jq -e ".topics | index(\"$topic\")" > /dev/null 2>&1; then return 0; fi
    done
    return 1
  }

  lang_is() {
    local lang
    for lang in "$@"; do
      if [ "$language" = "$lang" ]; then return 0; fi
    done
    return 1
  }

  if has_topic "nature" "plants" "ecology" "gardening" "wildlife" "botany" "forestry" "conservation"; then echo "Projects/Nature"; return; fi
  if has_topic "drawing" "illustration" "sketching" "ink" "pen" || desc_has "drawing" "sketch" "illustration"; then echo "Projects/Drawing"; return; fi
  if has_topic "blog" "writing" "publishing" && ! has_topic "music" "audio"; then echo "Projects/Blog"; return; fi

  if has_topic "music" "synthesis" "synth" "midi" "daw" \
                "music-production" "dsp" "sampling" \
                "drum-machine" "eurorack" "osc"; then echo "Areas/Music"; return; fi
  if has_topic "audio" && ! has_topic "ai" "llm" "machine-learning" "deep-learning" "nlp" "neural-network" "transformer" "pytorch" "tensorflow"; then echo "Areas/Music"; return; fi
  if echo "$desc" | grep -qiE "\bsynth\b|\bsynths\b|\bsampler\b|\bmixer\b|\bmixing\b|\bableton\b|\bdaw\b|\bmidi\b|\bvst\b|\bdrum machine\b"; then echo "Areas/Music"; return; fi

  if has_topic "cyberpunk" "politics" "philosophy" "critical-theory" \
               "surveillance" "privacy" "decentralization" "dystopia" \
               "counter-culture" "social-media"; then echo "Areas/Cyberpunks"; return; fi
  if desc_has "cyberpunk" "surveillance" "privacy" "decentralized" \
              "algorithmic" "platform capitalism"; then echo "Areas/Cyberpunks"; return; fi

  if has_topic "writing" "storytelling" "narrative" "fiction" "nonfiction" "essay" "poetry"; then echo "Areas/Writing"; return; fi
  if desc_has "storytelling" "narrative" "fiction"; then echo "Areas/Storytelling"; return; fi

  if has_topic "ai" "llm" "machine-learning" "deep-learning" "nlp" \
               "neural-network" "transformer" "embedding" "rag" \
               "agent" "autonomous" "reasoning" "gpt" "claude" \
               "openai" "anthropic" "huggingface"; then echo "Resources/AI"; return; fi
  if desc_has "ai" "llm" "large language model" "machine learning" \
              "deep learning" "neural network" "transformer" \
              "embedding" "rag" "agent"; then echo "Resources/AI"; return; fi

  if has_topic "engineering" "programming" "web" "framework" "library" \
               "compiler" "database" "devtools" "cli" "api" "sdk" \
               "tooling" "language" "runtime" "wasm" "webassembly" \
               "backend" "frontend" "testing" "ci" "cd" \
               "git" "version-control" "editor" "ide" "plugin" \
               "infrastructure" "cloud" "serverless" "container" \
               "kubernetes" "networking" "protocol" "http" "rest" \
               "graphql" "grpc" "websocket" "streaming" "realtime"; then echo "Resources/Engineering"; return; fi

  if lang_is "Rust" "TypeScript" "JavaScript" "Python" "Go" "Zig" \
              "C" "C++" "Java" "Kotlin" "Swift" "Ruby" "Elixir" \
              "Haskell" "OCaml" "Lua" "Nim" "Dart" "Solidity" \
              "Shell" "Makefile" "Dockerfile"; then
    if ! has_topic "music" "audio" "art" "design" "writing" "math" "health"; then
      echo "Resources/Engineering"; return
    fi
  fi

  if has_topic "design" "ui" "ux" "css" "typography" "color" "layout" "responsive" "animation" "motion"; then echo "Resources/Design"; return; fi
  if has_topic "art" "generative-art" "generative" "creative-coding" "processing" "three.js" "webgl" "shader" "glsl" "visual" "graphics" "rendering" "ray-tracing"; then echo "Resources/Art"; return; fi
  if has_topic "finance" "investing" "economics" "trading" "crypto" "blockchain" "defi" "web3"; then echo "Resources/Finance"; return; fi
  if has_topic "health" "fitness" "wellness" "medicine" "biology" "neuroscience" "psychology" "mental-health"; then echo "Resources/Health"; return; fi
  if has_topic "math" "mathematics" "algebra" "geometry" "calculus" "statistics" "probability" "linear-algebra"; then echo "Resources/Math"; return; fi
  if has_topic "manufacturing" "hardware" "cnc" "3d-printing" "laser" "fabrication" "electronics" "arduino" "raspberry-pi" "embedded" "iot"; then echo "Resources/Manufacturing"; return; fi
  if has_topic "photography" "camera" "image-processing" "computer-vision" "exif" "photo"; then echo "Resources/Art"; return; fi
  if has_topic "history" "anthropology" "archaeology" "sociology"; then echo "Archive/History"; return; fi

  echo "Resources/GitHub Stars"
}

create_note() {
  local repo_json="$1"
  local full_name description language stars repo_created html_url owner
  full_name=$(echo "$repo_json" | jq -r '.full_name')
  description=$(echo "$repo_json" | jq -r '.description // ""')
  language=$(echo "$repo_json" | jq -r '.language // ""')
  stars=$(echo "$repo_json" | jq -r '.stargazers_count')
  repo_created=$(echo "$repo_json" | jq -r '.created_at' | cut -d'T' -f1)
  html_url=$(echo "$repo_json" | jq -r '.html_url')
  owner=$(echo "$repo_json" | jq -r '.owner.login')

  local para_path
  para_path=$(echo "$repo_json" | determine_path)
  local para_dir="$VAULT/$para_path"
  mkdir -p "$para_dir"

  local filename
  filename=$(echo "$full_name" | sed 's/\//-/')
  local filepath="$para_dir/$filename.md"

  cat > "$filepath" <<NOTE
---
title: "$full_name"
source: "$html_url"
github: $full_name
author:
  - "[[$owner]]"
created: $repo_created
stars: $stars
language: "$language"
tags:
  - "github-stars"
NOTE

  echo "$repo_json" | jq -r '.topics[] // ""' 2>/dev/null | while IFS= read -r topic; do
    if [ -n "$topic" ]; then
      echo "  - \"$topic\"" >> "$filepath"
    fi
  done

  cat >> "$filepath" <<NOTE

---
$description
NOTE

  echo -e "  ${GREEN}CREATED${NC} $full_name -> $para_path"
}


echo -e "${BLUE}=== GitHub Stars Sync ===${NC}"
echo "User: $GITHUB_USER"
echo "Vault: $VAULT"
echo ""

existing_count=$(rg -l "^github: " "$VAULT" --glob '*.md' 2>/dev/null | wc -l | tr -d ' ' || echo "0")
echo "Existing github-starred notes in vault: $existing_count"
echo ""

page=1
total_created=0
total_skipped=0
total_errors=0

while true; do
  echo -e "${BLUE}Fetching page $page...${NC}"

  response=$(curl -s "https://api.github.com/users/$GITHUB_USER/starred?per_page=100&page=$page")

  if echo "$response" | jq -e '.message' > /dev/null 2>&1; then
    msg=$(echo "$response" | jq -r '.message')
    echo -e "  ${YELLOW}API error: $msg${NC}"
    break
  fi

  count=$(echo "$response" | jq 'length')
  if [ "$count" -eq 0 ]; then
    echo "  (empty page - done)"
    break
  fi

  for i in $(seq 0 $((count - 1))); do
    repo_json=$(echo "$response" | jq ".[$i]")
    full_name=$(echo "$repo_json" | jq -r '.full_name')

    if rg -q "^github: $full_name$" "$VAULT" --glob '*.md' 2>/dev/null; then
      echo -e "  ${YELLOW}SKIP${NC}    $full_name (already in vault)"
      total_skipped=$((total_skipped + 1))
    else
      if create_note "$repo_json"; then
        total_created=$((total_created + 1))
      else
        echo -e "  ${RED}ERROR${NC}   $full_name"
        total_errors=$((total_errors + 1))
      fi
    fi
  done

  if [ "$count" -lt 100 ]; then
    break
  fi

  page=$((page + 1))
done

echo ""
echo -e "${BLUE}=== Summary ===${NC}"
echo "  Created: $total_created"
echo "  Skipped: $total_skipped"
echo "  Errors:  $total_errors"

if [ "$total_created" -gt 0 ]; then
  echo ""
  echo "Notes distributed across PARA sections based on repo topics/language/description."
  echo "Each section's :feed.md will surface new entries alongside existing clippings."
fi
