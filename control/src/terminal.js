/**
 * The browser terminal page. Built here, on the machine running control, and
 * shipped inside host/, so a host needs no network to serve it. See control/scripts/terminal-build.sh.
 */
import { join } from "node:path"
import { stream, step } from "./exec.js"
import { ROOT } from "./paths.js"

export async function buildTerminal() {
  step("build the terminal page")
  await stream("bash", [join(ROOT, "control", "scripts", "terminal-build.sh")])
}
