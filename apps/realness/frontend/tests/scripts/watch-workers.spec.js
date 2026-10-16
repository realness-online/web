import { EventEmitter } from 'node:events'
import { describe, expect, it, vi } from 'vite-plus/test'
import { main, worker_names } from '../../scripts/watch-workers.js'

const setup = () => {
  const started = []
  const start = vi.fn((command, args, options) => {
    const child = new EventEmitter()
    child.kill = vi.fn()
    started.push({ command, args, options, child })
    return child
  })
  const exit = vi.fn()
  const host = new EventEmitter()
  main({ start, exit, host })
  return { started, exit, host }
}

describe('watch-workers main', () => {
  it('starts one watch build per worker', () => {
    const { started } = setup()
    expect(started.map(s => s.options.env.WORKER_NAME)).toEqual(worker_names)
    expect(started[0].command).toBe('vp')
    expect(started[0].args).toContain('--watch')
  })

  it('ignores a clean exit', () => {
    const { started, exit } = setup()
    started[0].child.emit('exit', 0)
    expect(exit).not.toHaveBeenCalled()
  })

  it('stops all and exits with the failing code', () => {
    const { started, exit } = setup()
    started[1].child.emit('exit', 3)
    expect(exit).toHaveBeenCalledWith(3)
    for (const { child } of started)
      expect(child.kill).toHaveBeenCalledWith('SIGTERM')
    started[2].child.emit('exit', null)
    expect(exit).toHaveBeenLastCalledWith(1)
  })

  it.each(['SIGINT', 'SIGTERM'])('stops all on %s', signal => {
    const { started, exit, host } = setup()
    host.emit(signal)
    expect(exit).toHaveBeenCalledWith(0)
    expect(started[0].child.kill).toHaveBeenCalled()
  })
})
