import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync
} from 'node:fs'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vite-plus/test'
import { artifacts_dir } from '../../scripts/lib/artifacts.js'

const exec = vi.hoisted(() => ({ calls: [], answer: () => '' }))
vi.mock('node:child_process', async original => {
  const real = await original()
  const execFileSync = (...args) => {
    exec.calls.push(args)
    return exec.answer(...args)
  }
  return {
    ...real,
    default: { ...real.default, execFileSync },
    execFileSync
  }
})

const {
  find_author,
  gcloud,
  main,
  parse_args,
  stamps,
  storage_list,
  upload_preview
} = await import('../../scripts/render-print-previews.js')

let root
let dist_dir
let out_dir
let chrome_path
beforeEach(() => {
  mkdirSync(artifacts_dir, { recursive: true })
  root = mkdtempSync(path.join(artifacts_dir, 'print-previews-test-'))
  dist_dir = path.join(root, 'dist')
  out_dir = path.join(root, 'out')
  chrome_path = path.join(root, 'chrome')
  mkdirSync(dist_dir)
  writeFileSync(path.join(dist_dir, 'index.html'), '<main></main>')
  writeFileSync(chrome_path, '')
  vi.spyOn(console, 'info').mockImplementation(() => {})
  vi.spyOn(console, 'error').mockImplementation(() => {})
})
afterEach(() => {
  rmSync(root, { recursive: true, force: true })
  vi.restoreAllMocks()
})

describe('parse_args', () => {
  it('reads limit, force, and upload', () => {
    expect(parse_args([])).toEqual({ limit: 0, force: false, upload: true })
    expect(parse_args(['--limit', '2', '--force', '--no-upload'])).toEqual({
      limit: 2,
      force: true,
      upload: false
    })
  })
})

describe('find_author', () => {
  it('prefers the environment, then .env.local, then .env', () => {
    expect(find_author('+1', root)).toBe('/+1')
    writeFileSync(path.join(root, '.env'), 'VITE_ADMIN_ID="/+2"\n')
    expect(find_author(undefined, root)).toBe('/+2')
    writeFileSync(path.join(root, '.env.local'), 'OTHER=1\n')
    expect(find_author(undefined, root)).toBe('/+2')
    writeFileSync(path.join(root, '.env.local'), "VITE_ADMIN_ID = '+3'\n")
    expect(find_author(undefined, root)).toBe('/+3')
  })

  it('fails without an author', () => {
    expect(() => find_author(undefined, root)).toThrow(/no author/)
  })
})

describe('stamps', () => {
  it('keeps plain stamps of one kind, newest first', () => {
    const urls = [
      'gs://b/p/1.html',
      'gs://b/p/3.html',
      'gs://b/p/3-layer.html',
      'gs://b/p/2.png'
    ]
    expect(stamps(urls, 'html')).toEqual([3, 1])
    expect(stamps(urls, 'png')).toEqual([2])
  })
})

describe('upload_preview', () => {
  it('copies with a png type and a download token', () => {
    const run = vi.fn()
    upload_preview('gs://b/1.png', '/f.png', run)
    const args = run.mock.calls[0][0]
    expect(args.slice(0, 4)).toEqual([
      'storage',
      'cp',
      '/f.png',
      'gs://b/1.png'
    ])
    expect(args).toContain('--content-type=image/png')
    expect(args.at(-1)).toMatch(/firebaseStorageDownloadTokens=[\w-]{36}$/)
  })
})

const png = `data:image/png;base64,${Buffer.from('png').toString('base64')}`

const setup = ({ listing, render } = {}) => {
  const launched = []
  const put = vi.fn()
  const evaluate = vi.fn(async expression =>
    expression.includes('.ready')
      ? true
      : (render ?? (async () => ({ png, width: 2, height: 3 })))(expression)
  )
  const options = {
    dist_dir,
    out_dir,
    chrome_path,
    bucket: 'b',
    author: () => '/+1',
    list: () =>
      listing ?? [
        'gs://b/people/+1/posters/1.html',
        'gs://b/people/+1/posters/2.html',
        'gs://b/people/+1/posters/2.png'
      ],
    put,
    port: 0,
    poll_ms: 0,
    ready_timeout_ms: 1000,
    launch: o => {
      launched.push(o)
      return { kill: () => launched.push('killed') }
    },
    page: async () => ({ evaluate })
  }
  return { options, launched, put, evaluate }
}

describe('main', () => {
  it('renders and uploads only missing previews', async () => {
    const { options, launched, put, evaluate } = setup()
    const result = await main({ ...options, args: [] })
    expect(result).toEqual({ rendered: [1], failed: [] })
    expect(evaluate).toHaveBeenCalledWith(
      'window.poster_driver.render_stored("/+1/posters/1")'
    )
    expect(put).toHaveBeenCalledWith(
      'gs://b/people/+1/posters/1.png',
      path.join(out_dir, '1.png')
    )
    expect(readFileSync(path.join(out_dir, '1.png'), 'utf8')).toBe('png')
    expect(launched[0].target_url).toMatch(/127\.0\.0\.1:\d+\/poster-driver$/)
    expect(launched.at(-1)).toBe('killed')
    expect(existsSync(launched[0].profile_dir)).toBe(false)
  })

  it('re-renders everything with --force and skips upload with --no-upload', async () => {
    const { options, put } = setup()
    const result = await main({ ...options, args: ['--force', '--no-upload'] })
    expect(result.rendered).toEqual([2, 1])
    expect(put).not.toHaveBeenCalled()
  })

  it('honors --limit', async () => {
    const { options } = setup()
    const result = await main({ ...options, args: ['--force', '--limit', '1'] })
    expect(result.rendered).toEqual([2])
  })

  it('does nothing when every preview exists', async () => {
    const { options, launched } = setup({
      listing: ['gs://b/p/1.html', 'gs://b/p/1.png']
    })
    expect(await main({ ...options, args: [] })).toEqual({
      rendered: [],
      failed: []
    })
    expect(launched).toEqual([])
  })

  it('fails when the shop lists no prints', async () => {
    const { options } = setup({ listing: [] })
    await expect(main({ ...options, args: [] })).rejects.toThrow(
      'no prints found under gs://b/people/+1/posters/'
    )
  })

  it('keeps going past a failed render, then fails', async () => {
    const { options } = setup({
      render: async expression => {
        if (expression.includes('/2"')) throw new Error('bad poster')
        return {}
      }
    })
    await expect(main({ ...options, args: ['--force'] })).rejects.toThrow(
      '2 failed: 2, 1'
    )
    expect(console.error).toHaveBeenCalledWith(
      'print-previews: 1 failed - render returned no png'
    )
  })

  it('needs the build and the browser', async () => {
    const { options } = setup()
    await expect(
      main({ ...options, args: [], chrome_path: `${chrome_path}-x` })
    ).rejects.toThrow(/CHROME_PATH not found/)
    rmSync(path.join(dist_dir, 'index.html'))
    await expect(main({ ...options, args: [] })).rejects.toThrow(
      /index.html missing/
    )
  })
})

describe('gcloud', () => {
  it('returns output and explains a failure', () => {
    exec.answer = () => 'ok'
    expect(gcloud(['a'])).toBe('ok')
    expect(exec.calls.at(-1)[0]).toBe('gcloud')
    exec.answer = () => {
      throw Object.assign(new Error('boom'), { stderr: ' denied \n' })
    }
    expect(() => gcloud(['storage', 'ls'])).toThrow(
      'gcloud failed (storage ls): denied'
    )
    exec.answer = () => {
      throw new Error('missing')
    }
    expect(() => gcloud(['x'])).toThrow('gcloud failed (x): missing')
  })
})

describe('storage_list', () => {
  it('lists trimmed lines, or nothing on failure', () => {
    exec.answer = () => ' gs://a/1.html \n\ngs://a/2.png\n'
    expect(storage_list('gs://a/')).toEqual(['gs://a/1.html', 'gs://a/2.png'])
    expect(exec.calls.at(-1)[1]).toEqual(['storage', 'ls', 'gs://a/'])
    exec.answer = () => {
      throw new Error('no such prefix')
    }
    expect(storage_list('gs://a/')).toEqual([])
  })
})
