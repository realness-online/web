import { readFile as read_file, access, mkdtemp, mkdir, rm } from "node:fs/promises"
import { join } from "node:path"
import { execFile as exec_file, spawn } from "node:child_process"
import { promisify } from "node:util"
import { once } from "node:events"
import { test } from "node:test"
import assert from "node:assert/strict"
import { out_path } from "#root/lib/output.js"

const root = new URL("../../", import.meta.url)
const run = promisify(exec_file)

for (const service of ["sync", "proxy"]) {
  test(`${service} staged entry starts without installed packages`, { timeout: 15000 }, async context => {
    const scratch = out_path("service-stage-tests")
    await mkdir(scratch, { recursive: true })
    const directory = await mkdtemp(join(scratch, `${service}-`))
    let child
    context.signal.addEventListener("abort", () => child?.kill(), { once: true })
    try {
      const { stdout } = await run("bash", ["server/scripts/stage-service.sh", service], { cwd: root, env: { ...process.env, BRAYNESS_OUT: directory } })
      const stage = stdout.trim()
      assert.deepEqual(JSON.parse(await read_file(join(stage, "package.json"), "utf8")), JSON.parse(await read_file(new URL("package.json", root), "utf8")))
      await assert.rejects(access(join(stage, "node_modules")), { code: "ENOENT" })
      const dockerfile = await read_file(join(stage, "Dockerfile"), "utf8")
      assert.ok(!dockerfile.includes("npm install"))
      assert.ok(dockerfile.includes(`server/${service}/bin/${service}-service.js`))

      child = spawn(process.execPath, [`server/${service}/bin/${service}-service.js`, ...(service === "sync" ? ["--dev"] : [])], {
        cwd: stage,
        env: { ...process.env, PORT: "0", LISTEN: "127.0.0.1", STORE: "disk", SYNC_DIR: join(directory, "data"), PINS_BUCKET: "test-bucket", MODEL_PASS_SECRET: "test-secret-123456789012345678901234567890", OPENROUTER_API_KEY: "test-key", K_SERVICE: "" },
        stdio: ["ignore", "pipe", "pipe"]
      })
      let stderr = ""
      child.stderr.on("data", chunk => { stderr += chunk })
      await new Promise((resolve, reject) => {
        let output = ""
        child.on("error", reject)
        child.on("exit", code => reject(new Error(`${service} exited ${code}: ${stderr}`)))
        child.stdout.on("data", chunk => {
          output += chunk
          if (output.includes(service === "sync" ? "# sync service on" : "proxy on")) resolve()
        })
      })
    } finally {
      if (child && child.exitCode === null && child.signalCode === null) {
        const exited = once(child, "exit")
        child.kill()
        await exited
      }
      await rm(directory, { recursive: true, force: true })
    }
  })
}
