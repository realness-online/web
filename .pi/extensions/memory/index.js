/**
 * Memory Extension
 *
 * `remember` - ranked recall over pi's own session transcripts.
 *
 * The transcripts live in `~/.pi/agent/sessions/`; this extension indexes
 * them into an FTS5 store and ranks turns, so a question is answered with
 * snippets and a file to reopen instead of a list of paths from `rg`.
 *
 * Two ways in: the `remember` tool for the agent, and `/remember` for a human
 * to read the same results in a widget.
 */
/**
 * @typedef {import("@earendil-works/pi-coding-agent").ExtensionAPI} ExtensionAPI
 * @typedef {import("./index-db.js").Result} Result
 */
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { join, normalize, relative, sep } from "node:path";
import { Type } from "typebox";
import { StringEnum } from "@earendil-works/pi-ai";
import {
  DB_PATH,
  VAULT_DIR,
  indexSessions,
  indexVault,
  recall,
  searchNotes,
  stats,
} from "./index-db.js";

/** vlt1: inside an actor the vault is on the Mac; `realness vault` asks it through sync. */
const IN_ACTOR = existsSync("/etc/realness/started");
const run = promisify(execFile);
const ask_mac = async (...args) =>
  JSON.parse(
    (await run("realness", ["vault", ...args, "--json"], { timeout: 30000, maxBuffer: 4 << 20 }))
      .stdout,
  );

/** A vault-relative note path that cannot step outside the vault. */
const note_path = (path) => {
  const clean = normalize(String(path ?? "")).replace(/^\/+/, "");
  if (
    !clean.endsWith(".md") ||
    clean.startsWith("..") ||
    clean.split(sep).some((part) => part.startsWith("."))
  )
    throw new Error("path must be a .md note inside the vault");
  return clean;
};

const find_notes = async (query, limit) =>
  IN_ACTOR
    ? (await ask_mac("search", query, "--limit", String(limit))).notes
    : searchNotes(query, { limit });

const read_note = async (path) =>
  IN_ACTOR
    ? (await ask_mac("note", path)).text
    : readFile(join(VAULT_DIR, note_path(path)), "utf8");

/** @param {Array<{ path: string, text: string }>} notes */
const formatNotes = (notes) =>
  notes.length
    ? `\n\nVault notes (read one with action note):\n${notes
        .map((n) => `- ${n.path}\n   ${n.text.replace(/\s+/g, " ").slice(0, 160)}`)
        .join("\n")}`
    : "";
/**
 * @param {string} query
 * @param {Result[]} results
 * @returns {string}
 */
/**
 * m0: a sealed month's session may not be on this device. Sync carries a
 * packed session under its plain `.html` name, so fetch that.
 * @param {string} file
 * @returns {string}
 */
const fetch_hint = (file) => {
  if (existsSync(file)) return "";
  const plain = file.replace(/\.html\.gz$/, ".html");
  const remote = relative(process.cwd(), plain).split(sep).join("/");
  return `\n   not on this device: realness cp can://~/harness/${remote} ${plain}`;
};
const formatResults = (query, results) => {
  if (!results.length) {
    return `No past sessions match "${query}".`;
  }
  const home = process.env.HOME ?? "";
  const blocks = results.map((hit, i) => {
    const when = hit.ts.slice(0, 16).replace("T", " ");
    const project = hit.project.split("/").filter(Boolean).pop() ?? "?";
    const text = hit.text
      .replaceAll("**", "")
      .replace(/[`#>*_]+/g, "")
      .replace(/\s+/g, " ")
      .trim();
    const snippet = text.length > 160 ? `${text.slice(0, 159)}…` : text;
    const file =
      home && hit.session_file.startsWith(home)
        ? `~${hit.session_file.slice(home.length)}`
        : hit.session_file;
    return `${i + 1}. ${when}  ${project}\n   ${snippet}\n   ${file}${fetch_hint(hit.session_file)}`;
  });
  const noun = results.length === 1 ? "match" : "matches";
  return `${results.length} ${noun} for "${query}"\n\n${blocks.join("\n\n")}`;
};
/**
 * @param {string} label
 * @param {string} line
 * @returns {string}
 */
const formatStats = (label, line) => {
  return `${label}\n${line}`;
};
/** @param {ExtensionAPI} pi */
const memoryExtension = (pi) => {
  pi.registerTool({
    name: "remember",
    label: "Remember",
    description:
      "Ranked recall over past pi sessions and vault notes. Indexes session transcripts into a " +
      "local FTS5 store and returns matching turns with snippets, a date, and the " +
      "session file to reopen. Use instead of grepping session JSONL when the " +
      "question is about earlier work - what we decided, tried, or fixed.",
    promptSnippet: "Search past sessions for earlier decisions and work",
    promptGuidelines: [
      'Use remember when the user asks "what did we do about X", "did we already ' +
        'try X", or when a task smells like a repeat of earlier work. Prefer it ' +
        "over reading session JSONL directly.",
    ],
    parameters: Type.Object({
      action: StringEnum(/** @type {const} */ (["search", "note", "index", "stats"])),
      path: Type.Optional(
        Type.String({
          description: "For action note: a vault note path from a search hit.",
        }),
      ),
      query: Type.Optional(
        Type.String({
          description:
            "Words to search for. Typos are tolerated; the last word is also matched as a prefix.",
        }),
      ),
      project: Type.Optional(
        Type.String({
          description: "Filter by part of the working directory, e.g. realness, seeq, realness.",
        }),
      ),
      since: Type.Optional(
        Type.String({
          description: "ISO date lower bound, e.g. 2026-09-01.",
        }),
      ),
      limit: Type.Optional(
        Type.Number({
          description: "Maximum hits (default 10).",
        }),
      ),
      full: Type.Optional(
        Type.Boolean({
          description: "For action index: re-read every session file, not just changed ones.",
        }),
      ),
    }),
    async execute(_toolCallId, params, _signal, onUpdate, ctx) {
      const action = params.action ?? "search";
      if (action === "index") {
        onUpdate?.({
          content: [
            {
              type: "text",
              text: "Indexing sessions...",
            },
          ],
          details: {},
        });
        const result = await indexSessions({
          full: params.full,
        });
        const after = stats();
        const text = formatStats(
          `Indexed ${result.indexed} of ${result.scanned} session file(s); ${result.turns} turn(s) read.`,
          `Store: ${after.path} - ${after.turns} turns across ${after.sessions} sessions.`,
        );
        return {
          content: [
            {
              type: "text",
              text,
            },
          ],
          details: result,
        };
      }
      if (action === "stats") {
        const s = stats();
        return {
          content: [
            {
              type: "text",
              text: `${s.path}\n${s.turns} turns, ${s.sessions} sessions, ${(s.bytes / 1048576).toFixed(1)} MB`,
            },
          ],
          details: s,
        };
      }
      if (action === "note") {
        const text = await read_note(note_path(params.path));
        return { content: [{ type: "text", text }], details: { path: params.path } };
      }
      const query = params.query?.trim();
      if (!query) throw new Error("query is required for action search");
      const notes = await find_notes(query, params.limit ?? 10).catch(() => []);
      const results = recall(query, {
        project: params.project,
        since: params.since,
        limit: params.limit ?? 10,
        partial: true,
        exclude_session: ctx?.sessionManager?.getSessionId(),
      });
      return {
        content: [
          {
            type: "text",
            text: formatResults(query, results) + formatNotes(notes),
          },
        ],
        details: {
          count: results.length,
          notes: notes.length,
        },
      };
    },
  });
  pi.on("session_start", async () => {
    try {
      await indexSessions({
        path: DB_PATH,
      });
      if (!IN_ACTOR) await indexVault({ path: DB_PATH });
    } catch {}
  });
  pi.registerCommand("remember", {
    description: "Search past sessions. Usage: /remember <words>. Results post to the chat.",
    handler: async (args, ctx) => {
      const query = (args || "").trim();
      if (!query) {
        ctx.ui.notify("remember: usage /remember <words>", "info");
        return;
      }
      const results = recall(query, {
        limit: 10,
        partial: true,
        exclude_session: ctx.sessionManager.getSessionId(),
      });
      pi.sendMessage({
        customType: "remember",
        content: formatResults(query, results),
        display: true,
        details: {
          query,
          count: results.length,
        },
      });
    },
  });
  pi.on("agent_settled", async () => {
    try {
      await indexSessions({
        root: undefined,
        path: DB_PATH,
      });
      if (!IN_ACTOR) await indexVault({ path: DB_PATH });
    } catch {}
  });
};
export default memoryExtension;
