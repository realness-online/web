/**
 * Edit Log Extension
 *
 * After every successful `edit` or `write`, logs the file's path and
 * fingerprint with the session and turn that made it. Sync uses the log to
 * decide: changes the log explains may delete or replay; the rest keep both.
 *
 * Formatters (pi-mono-auto-fix) rewrite files once the agent stops, so every
 * touched path is fingerprinted again once it holds still, as tool `settle`.
 *
 * Each agent run is bracketed by `brayness turn-start` and `turn-end`, which
 * log whatever changed in synced folders during it (bash too). Desktop turns
 * upload only with REALNESS_TURN_SYNC=1 while sync is rebuilt; actors still sync.
 */
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { execFile, spawn } from "node:child_process";
import { createRequire } from "node:module";
import { existsSync, mkdirSync, openSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { promisify } from "node:util";
import { openLog, record, sha, stateDir, useHarnessState } from "./log.ts";

const MANIFEST = "apps/realness/package.json";
/** In an actor the `brayness` wrapper is on PATH and marks itself; never a file path. */
const in_actor = () => process.env.BRAYNESS_ACTOR === "1";
/** Desktop runs the repo's command; an actor runs its `brayness` wrapper. */
const sync_command = (root: string, args: string[]): [string, string[]] =>
	!in_actor() && existsSync(join(root, MANIFEST)) ? [process.execPath, [createRequire(join(root, MANIFEST)).resolve("brayness/command"), ...args]] : ["brayness", args];

/** The harness root holding the brayness command, from cwd upward. */
function harness(cwd: string): string | undefined {
	for (let dir = resolve(cwd); ; dir = dirname(dir)) {
		if (existsSync(join(dir, MANIFEST)) || (in_actor() && existsSync(join(dir, ".pi/agent")))) return dir;
		if (dirname(dir) === dir) return undefined;
	}
}

export default function editLog(pi: ExtensionAPI) {
	const home = harness(process.cwd());
	if (home) useHarnessState(home);
	let db: ReturnType<typeof openLog> | undefined;
	let turn = 0;
	const touched = new Map<string, { session: string; turn: number; sha: string | null }>();

	const fingerprint = (path: string) => {
		try {
			return sha(readFileSync(path));
		} catch {
			return null;
		}
	};
	const log = (ctx: { ui: { notify: (m: string, l: "warning") => void } }, edit: Parameters<typeof record>[1]) => {
		try {
			db ??= openLog();
			record(db, edit);
		} catch (error) {
			ctx.ui.notify(`edit-log: ${(error as Error).message}`, "warning");
		}
	};

	pi.on("turn_start", (event) => {
		turn = event.turnIndex;
	});

	pi.on("tool_result", (event, ctx) => {
		if (event.isError || (event.toolName !== "edit" && event.toolName !== "write")) return;
		const given = (event.input as { path?: unknown }).path;
		if (typeof given !== "string") return;
		const path = resolve(ctx.cwd, given.replace(/^@/, ""));
		const session = ctx.sessionManager.getSessionFile() ?? "ephemeral";
		const now = fingerprint(path);
		touched.set(path, { session, turn, sha: now });
		log(ctx, { path, sha: now, session, turn, tool: event.toolName, tool_call: event.toolCallId, ts: new Date().toISOString() });
	});

	type Ctx = Parameters<typeof log>[0];
	let waiting: ReturnType<typeof setTimeout> | undefined;

	let open: { root: string; session: string } | undefined;

	/** Log the finished turn and sync, detached so pi never waits on the network. */
	const endTurn = () => {
		if (!open) return;
		const { root, session } = open;
		open = undefined;
		mkdirSync(stateDir(), { recursive: true });
		const out = openSync(join(stateDir(), "sync.log"), "a");
		const [command, args] = sync_command(root, ["turn-end", "--session", session, "--turn", String(turn)]);
		spawn(command, args, {
			cwd: root,
			detached: true,
			stdio: ["ignore", out, out],
		}).unref();
	};

	/** Fingerprint touched files again; anything a formatter changed is logged as `settle`. */
	const settle = (ctx: Ctx) => {
		clearTimeout(waiting);
		waiting = undefined;
		for (const [path, was] of touched) {
			const now = fingerprint(path);
			if (now === was.sha) continue;
			log(ctx, { path, sha: now, session: was.session, turn: was.turn, tool: "settle", tool_call: "", ts: new Date().toISOString() });
		}
		touched.clear();
		endTurn();
	};

	const stamp = () => [...touched.keys()].map((path) => fingerprint(path)).join();

	pi.on("agent_end", (_event, ctx) => {
		if (!touched.size) return settle(ctx);
		let last = stamp();
		let quiet = 0;
		const started = Date.now();
		const check = () => {
			const now = stamp();
			quiet = now === last ? quiet + 1 : 0;
			last = now;
			if (quiet >= 2 || Date.now() - started > 30_000) settle(ctx);
			else waiting = setTimeout(check, 1000);
		};
		waiting = setTimeout(check, 1000);
	});
	pi.on("agent_start", async (_event, ctx) => {
		settle(ctx);
		const root = harness(ctx.cwd);
		if (!root) return;
		const session = ctx.sessionManager.getSessionFile() ?? "ephemeral";
		try {
			const [command, args] = sync_command(root, ["turn-start", "--session", session]);
			await promisify(execFile)(command, args, { cwd: root });
			open = { root, session };
		} catch (error) {
			ctx.ui.notify(`edit-log: turn-start failed: ${(error as Error).message}`, "warning");
		}
	});
	pi.on("session_shutdown", (_event, ctx) => {
		settle(ctx);
		db?.close();
		db = undefined;
	});
}
