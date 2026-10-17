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
import {
  image_data_url,
  list_images,
  main,
  poster_stem,
  preflight
} from '../../scripts/render-poster.js'

let root
let input_path
let chrome_path
let out_dir
beforeEach(() => {
  mkdirSync(artifacts_dir, { recursive: true })
  root = mkdtempSync(path.join(artifacts_dir, 'render-poster-test-'))
  input_path = path.join(root, 'photo.jpg')
  chrome_path = path.join(root, 'chrome')
  out_dir = path.join(root, 'out')
  writeFileSync(input_path, 'jpeg')
  writeFileSync(chrome_path, '')
  vi.spyOn(console, 'info').mockImplementation(() => {})
  vi.spyOn(console, 'error').mockImplementation(() => {})
})
afterEach(() => {
  rmSync(root, { recursive: true, force: true })
  vi.restoreAllMocks()
})

describe('preflight', () => {
  it('needs an image and a browser', () => {
    expect(() => preflight(input_path, chrome_path)).not.toThrow()
    expect(() => preflight(undefined, chrome_path)).toThrow(/usage/)
    expect(() => preflight(input_path, undefined)).toThrow(/not set/)
    expect(() => preflight(input_path, `${chrome_path}-x`)).toThrow(
      /CHROME_PATH not found/
    )
    expect(() => preflight(`${input_path}-x`, chrome_path)).toThrow(
      /image not found/
    )
  })
})

describe('helpers', () => {
  it('encodes the image and names the poster', () => {
    expect(image_data_url(input_path)).toBe(
      `data:image/jpg;base64,${Buffer.from('jpeg').toString('base64')}`
    )
    expect(poster_stem('/+1.2/posters/3')).toBe('_+1-2_posters_3')
  })
})

const png = `data:image/png;base64,${Buffer.from('png').toString('base64')}`

const browser = () => {
  const launched = []
  return {
    launched,
    launch: options => {
      launched.push(options)
      return { kill: () => launched.push('killed') }
    }
  }
}

const page_with = render => async () => ({
  send: async method => {
    if (method === 'Log.enable') throw new Error('no log')
  },
  evaluate: async expression => {
    if (expression.includes('.ready')) return true
    if (expression.includes('debug')) throw new Error('no debug')
    return render(expression)
  }
})

const run = options =>
  main({
    input_path,
    chrome_path,
    origin: 'https://a.test',
    out_dir,
    poll_ms: 0,
    ready_timeout_ms: 1000,
    ...options
  })

describe('main', () => {
  it('writes the svg and png and shuts the browser', async () => {
    const { launched, launch } = browser()
    const render = vi.fn(async () => ({
      itemid: '/+1/posters/2',
      svg: '<svg/>',
      png,
      viewbox: '0 0 1 1',
      width: 1,
      height: 1
    }))
    const files = await run({ launch, page: page_with(render) })
    expect(files.map(f => path.basename(f))).toEqual([
      '_+1_posters_2.svg',
      '_+1_posters_2.png'
    ])
    expect(readFileSync(files[0], 'utf8')).toBe('<svg/>')
    expect(readFileSync(files[1], 'utf8')).toBe('png')
    expect(render.mock.calls[0][0]).toContain(image_data_url(input_path))
    expect(launched[0].target_url).toBe('https://a.test/poster-driver')
    expect(launched.at(-1)).toBe('killed')
    expect(existsSync(launched[0].profile_dir)).toBe(false)
  })

  it('writes only the svg when there is no png', async () => {
    const { launch } = browser()
    const files = await run({
      launch,
      page: page_with(async () => ({ itemid: 'a', svg: '<svg/>' }))
    })
    expect(files).toHaveLength(1)
  })

  it('fails on an empty render', async () => {
    const { launched, launch } = browser()
    await expect(
      run({ launch, page: page_with(async () => null) })
    ).rejects.toThrow(/nothing useful/)
    expect(launched.at(-1)).toBe('killed')
  })

  it('reports a render error with debug info', async () => {
    const { launch } = browser()
    await expect(
      run({
        launch,
        page: page_with(async () => {
          throw new Error('render broke')
        })
      })
    ).rejects.toThrow('render broke')
    expect(console.error).toHaveBeenCalledWith(
      'render-poster: render failed',
      'render broke',
      '| debug:',
      'null'
    )
  })

  it('converts a folder in one browser, named by image', async () => {
    const folder = path.join(root, 'shoot')
    mkdirSync(folder)
    writeFileSync(path.join(folder, 'b.PNG'), 'b')
    writeFileSync(path.join(folder, 'a.jpg'), 'a')
    writeFileSync(path.join(folder, 'notes.txt'), 'x')
    expect(list_images(folder).map(f => path.basename(f))).toEqual([
      'a.jpg',
      'b.PNG'
    ])
    const { launched, launch } = browser()
    const files = await main({
      input_path: folder,
      chrome_path,
      poll_ms: 0,
      launch,
      page: page_with(async () => ({ itemid: 'x', svg: '<svg/>' }))
    })
    expect(files).toEqual([
      path.join(folder, 'posters', 'a.svg'),
      path.join(folder, 'posters', 'b.svg')
    ])
    expect(launched.filter(l => l !== 'killed')).toHaveLength(1)
  })

  it('skips a failed image and reports it after the rest', async () => {
    const folder = path.join(root, 'shoot')
    mkdirSync(folder)
    writeFileSync(path.join(folder, 'a.jpg'), 'a')
    writeFileSync(path.join(folder, 'b.jpg'), 'b')
    const { launch } = browser()
    await expect(
      run({
        input_path: folder,
        launch,
        page: page_with(async expression =>
          expression.includes(Buffer.from('a').toString('base64'))
            ? null
            : { itemid: 'x', svg: '<svg/>' }
        )
      })
    ).rejects.toThrow('1 of 2 failed: a.jpg')
    expect(existsSync(path.join(out_dir, 'b.svg'))).toBe(true)
  })

  it('fails on a folder with no images', async () => {
    const folder = path.join(root, 'empty')
    mkdirSync(folder)
    const { launched, launch } = browser()
    await expect(run({ input_path: folder, launch })).rejects.toThrow(
      /no images/
    )
    expect(launched).toEqual([])
  })

  it('checks inputs before launching', async () => {
    const { launched, launch } = browser()
    await expect(run({ launch, input_path: undefined })).rejects.toThrow(
      /usage/
    )
    expect(launched).toEqual([])
  })
})
