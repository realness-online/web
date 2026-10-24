import { it } from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync as spawn_sync } from 'node:child_process'
import { fileURLToPath as file_url_to_path } from 'node:url'

const holder = file_url_to_path(
  new URL('../../server/halo/guest/realness-pty', import.meta.url)
)

/** Fork an interactive bash on a pty, run `command` in it, and ask the holder. */
const check = command =>
  spawn_sync(
    'python3',
    [
      '-c',
      `
import importlib.machinery, importlib.util, os, pty, sys, time
loader = importlib.machinery.SourceFileLoader('holder', sys.argv[1])
spec = importlib.util.spec_from_loader('holder', loader)
holder = importlib.util.module_from_spec(spec)
loader.exec_module(holder)
pid, master = pty.fork()
if pid == 0:
    os.execvp('bash', ['bash', '--norc', '--noprofile', '-i'])
time.sleep(0.5)
if sys.argv[2]:
    os.write(master, (sys.argv[2] + '\\r').encode())
    time.sleep(0.5)
print(holder.running_command(pid, master))
os.kill(pid, 9)
`,
      holder,
      command
    ],
    { encoding: 'utf8' }
  ).stdout.trim()

it('the shell at its prompt is not running a command', () => {
  assert.equal(check(''), 'False')
})

it('a command the shell runs as its child counts, so the opener is dropped', () => {
  assert.equal(check('sleep 3'), 'True')
})
