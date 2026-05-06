import { spawn } from 'node:child_process'

const worker_names = ['vector', 'compressor', 'tracer']
const child_processes = []

const stop_all = () => {
  for (const child_process of child_processes) child_process.kill('SIGTERM')
}

for (const worker_name of worker_names) {
  const child_process = spawn(
    'vp',
    ['build', '-c', 'workers.config.js', '--watch'],
    {
      stdio: 'inherit',
      shell: true,
      env: {
        ...process.env,
        WORKER_NAME: worker_name
      }
    }
  )

  child_process.on('exit', exit_code => {
    if (exit_code === 0) return
    stop_all()
    process.exit(exit_code ?? 1)
  })

  child_processes.push(child_process)
}

process.on('SIGINT', () => {
  stop_all()
  process.exit(0)
})

process.on('SIGTERM', () => {
  stop_all()
  process.exit(0)
})
