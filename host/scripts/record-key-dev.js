// Dev only: the local sync disk and Lima host share this checkout.
// A root-only host key is generated once and registered with local sync.
import { randomBytes } from "node:crypto"
import { mkdirSync, readFileSync, writeFileSync, chmodSync, existsSync } from "node:fs"
import { hostname } from "node:os"
import { disk } from "../../can-store/src/disk.js"

const path = "/etc/brayness/record-secret"
const name = hostname()
mkdirSync("/etc/brayness", { recursive: true, mode: 0o700 })
if (!existsSync(path)) writeFileSync(path, randomBytes(32).toString("hex"), { mode: 0o600, flag: "wx" })
chmodSync(path, 0o600)
const key = readFileSync(path, "utf8").trim()
const storage = disk(process.env.SYNC_DIR)
await storage.put(`host-keys/${name}`, key)
// The dev sync disk is separate from the deployed bucket. The known dev test
// number needs an admin entry here for webspace dev host status.
if (!await storage.get("admins.html")) await storage.put("admins.html", '<a href="tel:+14156667777">Dev operator</a>')
