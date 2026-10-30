import assert from 'node:assert/strict'
import { it } from 'node:test'
import { PassThrough } from 'node:stream'
import {
  first_line,
  foreground_busy,
  home_of,
  relay,
  runs_other,
  shell_address
} from '../../server/halo/guest/realness-pty.js'

/** A `/proc/<pid>/stat` line with the given foreground group. */
const stat = (pid, foreground) =>
  `${pid} (bash) S ${pid} ${pid} ${pid} 34816 ${foreground} 4194560 1 0 0`

it('the shell at its prompt is not running a command', () => {
  assert.equal(foreground_busy(stat(42, 42), 42), false)
})

it("a command in the shell's foreground group counts, so the opener is dropped", () => {
  assert.equal(foreground_busy(stat(42, 77), 42), true)
})

it('a shell with no controlling terminal runs nothing', () => {
  assert.equal(foreground_busy(stat(42, 0), 42), false)
})

it('a shell that execs into something else runs a command', () => {
  assert.equal(runs_other('/usr/bin/bash'), false)
  assert.equal(runs_other('/bin/bash'), false)
  assert.equal(runs_other('/usr/local/bin/pi'), true)
})

it("the shell's HOME is the realness user's own home, where its startup files live", () => {
  const passwd =
    'root:x:0:0:root:/root:/bin/bash\nrealness:x:1000:1000::/home/person:/bin/bash\n'
  assert.equal(home_of('realness', passwd), '/home/person')
})

it('keystrokes after the session line reach the holder, byte for byte', async () => {
  const page = new PassThrough()
  const holder = new PassThrough()
  const received = []
  holder.on('data', chunk => received.push(chunk))
  page.write('{"session":"p1"}\nfirst ')
  const { line, rest } = await first_line(page)
  assert.equal(line, '{"session":"p1"}\n')
  relay(holder, rest, page, new PassThrough())
  page.write(Buffer.from('typed é ✓', 'utf8'))
  await new Promise(done => setImmediate(done))
  assert.equal(Buffer.concat(received).toString('utf8'), 'first typed é ✓')
})

it('a pane shell starts as a normal terminal: it echoes typing and ends lines with CR LF', () => {
  const address = shell_address('/bin/bash')
  assert.match(address, /^EXEC:\/bin\/bash,pty,setsid,ctty,stderr$/)
  for (const raw of ['rawer', 'raw', 'echo=0', 'echo=false'])
    assert.ok(!address.split(',').includes(raw), raw)
})
