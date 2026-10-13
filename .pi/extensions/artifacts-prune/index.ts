/**
 * Artifacts Prune Extension
 *
 * Runs `bin/artifacts-prune.js --apply` once a run settles, so scratch under
 * `artifacts/` does not grow without bound. The script removes only
 * regenerable things, and a failure never disturbs the session.
 */

import { execFile } from "node:child_process";
import { existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { promisify } from "node:util";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

const run = promisify(execFile);

function findHarnessRoot(cwd: string): string | null {
	let dir = resolve(cwd);
	while (true) {
		if (existsSync(join(dir, "AGENTS.md")) && existsSync(join(dir, "work"))) {
			return dir;
		}
		const parent = dirname(dir);
		if (parent === dir) return null;
		dir = parent;
	}
}

export default function (pi: ExtensionAPI) {
	pi.on("agent_settled", async (_event, ctx) => {
		const root = findHarnessRoot(ctx.cwd);
		if (!root) return;
		const script = join(root, "bin/artifacts-prune.js");
		if (!existsSync(script)) return;

		try {
			const { stdout } = await run(
				process.execPath,
				[script, "--apply", "--quiet"],
				{ cwd: root, timeout: 60_000 },
			);
			const match = /freed (\d+) bytes/.exec(stdout);
			const freed = match ? Number(match[1]) : 0;
			if (freed > 0) {
				ctx.ui.notify(
					`artifacts prune: freed ${(freed / 1_048_576).toFixed(1)} MiB`,
					"info",
				);
			}
		} catch {
		}
	});
}
