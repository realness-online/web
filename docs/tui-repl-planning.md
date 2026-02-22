# TUI REPL Planning

Chat interface that reads the repo and helps make changes. pi-mono provides the REPL foundation we can improve over time.

## Goal

- Terminal chat/REPL for realness/web development
- Reads codebase, understands structure, helps implement changes
- Built on pi-mono (coding agent + TUI)

## pi-mono Stack

| Package             | Role                                                          |
| ------------------- | ------------------------------------------------------------- |
| **pi-tui**          | Terminal UI (Editor, Input, Markdown, differential rendering) |
| **pi-agent-core**   | Agent runtime, tool calling, session state                    |
| **pi-ai**           | Multi-provider LLM API (OpenAI, Anthropic, etc.)              |
| **pi-coding-agent** | CLI with read, bash, edit, write tools                        |

Entry point: `npx tsx packages/coding-agent/src/cli.ts` (or `npm exec pi` when installed)

## Realness Context

- Vue 3 + Vite, Firebase, JSDoc types
- Conventions: snake_case, no semicolons, `.cursorrules` for AI guidance
- Types in `/src/types.js`, itemid utils in `/src/utils/itemid.js`

## Implementation: JavaScript + JSDoc

Our code stays JavaScript with JSDoc types. No TypeScript in realness source.

- **pi as dependency** – pi-coding-agent is TS; we use its built output. No conflict.
- **Any custom code we add** – JS + JSDoc. Types in `@/types.js`, follow existing patterns.
- **tsconfig** – `allowJs`, `checkJs` already enabled. Our JS is type-checked via `npm run type`.
- **Agent output** – pi edits our files. Its edits should follow our conventions (snake_case, no semicolons, etc.) via prompt context.

If we build a custom REPL from scratch instead of wrapping pi, we'd write the REPL entry and tools in JS. pi-tui/pi-agent-core are TS packages; we could consume their dist (with `.d.ts` for editor support) or use JS-native alternatives (e.g. ink, blessed) and keep the whole stack JS.

## Approach Options

1. **Use pi directly** – Add pi as devDep, configure `.pi` with realness-specific instructions. Minimal setup.

2. **Custom REPL** – pi-tui + pi-agent-core + realness tooling. More control, more work.

3. **Extend pi** – Fork or wrap pi-coding-agent, add realness-specific tools (e.g. MCP for Thoughts when local server exists).

## npm run chat

```json
"chat": "node scripts/chat.js"
```

`scripts/chat.js` loads env from `.env.local` (or `.env`) via dotenv, then spawns `npx pi` with that env. Keys must be available to the pi process.

## API Key Configuration

pi reads keys from `process.env`. No dotenv by default. Two approaches:

**1. Env vars via dotenv (our wrapper)**

Load keys before running pi. Add to `.env.local` (gitignored):

```
ANTHROPIC_API_KEY=sk-ant-...
# or
OPENAI_API_KEY=sk-...
# or
GEMINI_API_KEY=...
```

Wrapper script loads dotenv and passes env to pi. User keeps keys in `.env.local` alongside Firebase config.

**2. pi's built-in /login**

pi has interactive `/login` for OAuth/subscription auth (Claude Pro, ChatGPT Plus, etc.). Stores credentials in `~/.pi/agent/auth.json`. No env vars needed for those providers.

**Provider env var names** (from pi-ai):

| Provider      | Env Var                                        |
| ------------- | ---------------------------------------------- |
| Anthropic     | `ANTHROPIC_API_KEY` or `ANTHROPIC_OAUTH_TOKEN` |
| OpenAI        | `OPENAI_API_KEY`                               |
| Google Gemini | `GEMINI_API_KEY`                               |
| Groq          | `GROQ_API_KEY`                                 |
| OpenRouter    | `OPENROUTER_API_KEY`                           |

Others: `CEREBRAS_API_KEY`, `XAI_API_KEY`, `MISTRAL_API_KEY`, etc. See pi-mono `packages/ai/src/env-api-keys.ts`.

## Next Steps

- [ ] Add `@mariozechner/pi-coding-agent` as devDep
- [ ] Add `scripts/chat.js` wrapper (load .env.local, spawn pi)
- [ ] Add `chat` script to package.json
- [ ] Add `.env.example` entries for chat keys (optional; document in this file)
- [ ] Define realness project context for the agent (.pi config or prompt)
- [ ] Test REPL, iterate on prompts and tools
