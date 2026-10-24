import { gate_fetch, start_actor } from '@/utils/gate'
import { records } from '@/utils/stream-records'

const failure = (code, cause, spill_path = undefined) => ({
  ok: /** @type {const} */ (false),
  error: Object.assign(new Error(cause.message ?? String(cause)), {
    name: 'ExecutionError',
    code,
    ...(spill_path ? { spillPath: spill_path } : {})
  })
})

const output_bytes = data =>
  Uint8Array.from(atob(data), character => character.charCodeAt(0))

const command_output = (options, context) => {
  const decoders = { stdout: new TextDecoder(), stderr: new TextDecoder() }
  const send = (text, stream) => {
    if (!text || !options.onOutput) return
    try {
      options.onOutput(text, context, { stream })
    } catch (cause) {
      throw Object.assign(
        new Error('Command output callback failed', { cause }),
        {
          code: 'callback_error'
        }
      )
    }
  }
  return {
    push(frame) {
      if (!Object.hasOwn(decoders, frame.stream))
        throw new Error('Invalid command output stream')
      send(
        decoders[frame.stream].decode(output_bytes(frame.data_b64), {
          stream: true
        }),
        frame.stream
      )
    },
    finish() {
      for (const [stream, decoder] of Object.entries(decoders))
        send(decoder.decode(), stream)
    }
  }
}

/**
 * @param {{ getIdToken: () => Promise<string> }} user
 * @param {{ actor?: string, cwd?: string, on_progress?: (event: any) => void }} [settings]
 */
export const create_vm_env = (
  user,
  { actor, cwd = '/realness', on_progress = () => {} } = {}
) => {
  const running = new Map()
  let target = actor
  return {
    cwd,
    async exec(command, options = {}, context) {
      const controller = new AbortController()
      const signal = context.abortSignal
        ? AbortSignal.any([context.abortSignal, controller.signal])
        : controller.signal
      let finished
      running.set(
        controller,
        new Promise(resolve => {
          finished = resolve
        })
      )
      try {
        signal.throwIfAborted()
        const ready = await start_actor(user, {
          actor: target,
          signal,
          on_progress
        })
        signal.throwIfAborted()
        const { id } = ready
        if (typeof id !== 'string' || !id || (target && id !== target))
          throw new Error('Command startup changed actor')
        target = id
        const response = await gate_fetch(
          user,
          `/v1/actors/${encodeURIComponent(id)}/exec`,
          {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            signal,
            body: JSON.stringify({
              argv:
                typeof command === 'string'
                  ? ['/bin/bash', '-c', command]
                  : command,
              cwd: options.cwd ?? cwd,
              env: options.env,
              inherit_env: options.inheritEnv,
              timeout: options.timeout ?? 0,
              spill: options.spill,
              stream: true
            })
          }
        )
        const output = command_output(options, context)
        for await (const frame of records(response.body)) {
          signal.throwIfAborted()
          if (frame.type === 'output') output.push(frame)
          else if (frame.type === 'exit') {
            output.finish()
            if (!Number.isInteger(frame.exit_code))
              throw new Error('Invalid command exit status')
            const value = {
              exitCode: frame.exit_code,
              ...(frame.spill_path ? { spillPath: frame.spill_path } : {})
            }
            if (!frame.error) return { ok: /** @type {const} */ (true), value }
            return failure(
              frame.error,
              `Command failed: ${frame.error}`,
              frame.spill_path
            )
          } else throw new Error('Invalid command frame')
        }
        throw new Error('Command stream ended before exit status')
      } catch (cause) {
        return failure(
          signal.aborted ? 'aborted' : (cause.code ?? 'unknown'),
          cause
        )
      } finally {
        controller.abort()
        running.delete(controller)
        finished()
      }
    },
    async cleanup() {
      const pending = [...running.values()]
      for (const controller of running.keys()) controller.abort()
      await Promise.all(pending)
    }
  }
}
