import assert from "node:assert/strict";
import { mkdtempSync, rmSync, writeFileSync, mkdirSync } from "node:fs";
import { join, resolve } from "node:path";
import { test } from "node:test";
import { last, openLog, record, sha } from "./log.ts";
import edit_log_extension from "./index.ts";

const scratch = resolve(import.meta.dirname, "../../../artifacts/brayness");

test("the newest edit to a path wins; other paths stay apart", () => {
	const dir = mkdtempSync(join(scratch, "edit-log-"));
	try {
		const db = openLog(join(dir, "edits.db"));
		const base = { session: "s.jsonl", tool: "edit", ts: "2026-09-27T00:00:00Z" };
		record(db, { ...base, path: "/h/a.md", sha: sha(Buffer.from("one")), turn: 1, tool_call: "t1" });
		record(db, { ...base, path: "/h/a.md", sha: sha(Buffer.from("two")), turn: 2, tool_call: "t2" });
		record(db, { ...base, path: "/h/b.md", sha: null, turn: 3, tool_call: "t3" });
		assert.equal(last(db, "/h/a.md")?.sha, sha(Buffer.from("two")));
		assert.equal(last(db, "/h/a.md")?.turn, 2);
		assert.equal(last(db, "/h/b.md")?.sha, null);
		assert.equal(last(db, "/h/c.md"), undefined);
		db.close();
	} finally {
		rmSync(dir, { recursive: true, force: true });
	}
});

test("successful edits retain JSONL, HTML, and compressed HTML session paths", () => {
	mkdirSync(scratch, { recursive: true });
	const dir = mkdtempSync(join(scratch, "edit-format-"));
	const previous = process.env.BRAYNESS_STATE;
	process.env.BRAYNESS_STATE = dir;
	const handlers = new Map<string, (event: unknown, ctx: unknown) => void>();
	const pi = { on: (name: string, handler: (event: unknown, ctx: unknown) => void) => handlers.set(name, handler) };
	try {
		edit_log_extension(pi as unknown as Parameters<typeof edit_log_extension>[0]);
		for (const suffix of ["jsonl", "html", "html.gz"]) {
			const file = join(dir, `${suffix}.md`);
			writeFileSync(file, "edited");
			const session = join(dir, `session.${suffix}`);
			const ctx = { cwd: dir, sessionManager: { getSessionFile: () => session }, ui: { notify: () => {} } };
			handlers.get("tool_result")!({ toolName: "edit", input: { path: file }, toolCallId: "call", isError: false }, ctx);
			const db = openLog(join(dir, "edits.db"));
			try { assert.equal(last(db, file)?.session, session); }
			finally { db.close(); }
		}
	} finally {
		handlers.get("session_shutdown")?.({}, { ui: { notify: () => {} } });
		if (previous === undefined) delete process.env.BRAYNESS_STATE;
		else process.env.BRAYNESS_STATE = previous;
		rmSync(dir, { recursive: true });
	}
});

test("fingerprints match sync's sha256 hex", () => {
	assert.equal(sha(Buffer.from("")), "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855");
});
