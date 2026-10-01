import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { is_typing, watch_for_updates } from '@/use/reload-on-update'

/**
 * Behaves like the built worker (vite-plugin-pwa, prompt mode): a new build
 * waits, and only activates - firing controllerchange on controlled pages -
 * when a page posts SKIP_WAITING to it.
 */
const fake_workers = ({ controlled = true, waiting = false } = {}) => {
  const workers = new EventTarget()
  const update = vi.fn(async () => {})
  const registration = { update, waiting: null }
  const activate = () => {
    registration.waiting = null
    workers.controller = {}
    workers.dispatchEvent(new Event('controllerchange'))
  }
  const install = () => {
    registration.waiting = {
      postMessage: vi.fn(message => {
        if (message?.type === 'SKIP_WAITING') activate()
      })
    }
    return registration.waiting
  }
  Object.assign(workers, {
    controller: controlled ? {} : null,
    getRegistration: vi.fn(async () => registration)
  })
  if (waiting) install()
  return { workers, update, registration, install, activate }
}

const fake_doc = () => {
  const doc = new EventTarget()
  Object.assign(doc, { visibilityState: 'visible', activeElement: null })
  return doc
}

const settle = () => new Promise(resolve => setTimeout(resolve, 0))
const show = async doc => {
  doc.visibilityState = 'visible'
  doc.dispatchEvent(new Event('visibilitychange'))
  await settle()
}
const hide = async doc => {
  doc.visibilityState = 'hidden'
  doc.dispatchEvent(new Event('visibilitychange'))
  await settle()
}

describe('@/use/reload-on-update', () => {
  let working, reload, stop

  beforeEach(() => {
    working = false
    reload = vi.fn()
  })

  afterEach(() => stop?.())

  const start = (workers, doc) => {
    stop = watch_for_updates({
      workers,
      doc,
      is_working: () => working,
      reload
    })
  }

  it('activates a waiting build while hidden, then reloads', async () => {
    const { workers } = fake_workers({ waiting: true })
    const doc = fake_doc()
    start(workers, doc)
    expect(reload).not.toHaveBeenCalled()
    await hide(doc)
    expect(reload).toHaveBeenCalledTimes(1)
  })

  it('never activates or reloads while the page is visible', async () => {
    const { workers, registration } = fake_workers({ waiting: true })
    const waiting = registration.waiting
    const doc = fake_doc()
    start(workers, doc)
    await show(doc)
    expect(waiting.postMessage).not.toHaveBeenCalled()
    expect(reload).not.toHaveBeenCalled()
  })

  it('finds a build deployed while the tab was open, on return', async () => {
    const { workers, update, install } = fake_workers()
    update.mockImplementation(async () => {
      install()
    })
    const doc = fake_doc()
    start(workers, doc)
    await hide(doc)
    expect(reload).not.toHaveBeenCalled()
    await show(doc)
    expect(update).toHaveBeenCalledTimes(1)
    await hide(doc)
    expect(reload).toHaveBeenCalledTimes(1)
  })

  it('leaves the page alone with nothing waiting', async () => {
    const { workers } = fake_workers()
    const doc = fake_doc()
    start(workers, doc)
    await hide(doc)
    expect(reload).not.toHaveBeenCalled()
  })

  it('does not activate for a page no worker controls yet', async () => {
    const { workers, registration } = fake_workers({
      controlled: false,
      waiting: true
    })
    const waiting = registration.waiting
    const doc = fake_doc()
    start(workers, doc)
    await hide(doc)
    expect(waiting.postMessage).not.toHaveBeenCalled()
    expect(reload).not.toHaveBeenCalled()
  })

  it('waits while anything is working, then updates on a later hide', async () => {
    const { workers, registration } = fake_workers({ waiting: true })
    const waiting = registration.waiting
    const doc = fake_doc()
    start(workers, doc)
    working = true
    await hide(doc)
    expect(waiting.postMessage).not.toHaveBeenCalled()
    working = false
    await show(doc)
    await hide(doc)
    expect(reload).toHaveBeenCalledTimes(1)
  })

  it('waits while a statement is half typed', async () => {
    const { workers, registration } = fake_workers({ waiting: true })
    const waiting = registration.waiting
    const doc = fake_doc()
    const textarea = document.createElement('textarea')
    textarea.value = 'half a thou'
    doc.activeElement = textarea
    start(workers, doc)
    await hide(doc)
    expect(waiting.postMessage).not.toHaveBeenCalled()
    textarea.value = ''
    await show(doc)
    await hide(doc)
    expect(reload).toHaveBeenCalledTimes(1)
  })

  it('reloads when another tab activated the build, at a safe moment', async () => {
    const { workers, activate } = fake_workers()
    const doc = fake_doc()
    start(workers, doc)
    activate()
    expect(reload).not.toHaveBeenCalled()
    await hide(doc)
    expect(reload).toHaveBeenCalledTimes(1)
  })

  it('ignores the first install, but not an update after it', async () => {
    const { workers, activate } = fake_workers({ controlled: false })
    const doc = fake_doc()
    start(workers, doc)
    activate()
    await hide(doc)
    expect(reload).not.toHaveBeenCalled()
    activate()
    expect(reload).toHaveBeenCalledTimes(1)
  })

  it('stops listening', async () => {
    const { workers, registration } = fake_workers({ waiting: true })
    const waiting = registration.waiting
    const doc = fake_doc()
    start(workers, doc)
    stop()
    await hide(doc)
    expect(waiting.postMessage).not.toHaveBeenCalled()
    expect(reload).not.toHaveBeenCalled()
  })

  describe('is_typing', () => {
    const focused = element => ({ activeElement: element })

    it('counts text in a focused field or editable', () => {
      const input = document.createElement('input')
      input.value = 'x'
      const editable = document.createElement('p')
      editable.setAttribute('contenteditable', 'true')
      editable.textContent = 'words'
      expect(is_typing(focused(input))).toBe(true)
      expect(is_typing(focused(editable))).toBe(true)
    })

    it('ignores empty fields, checkboxes, and nothing focused', () => {
      const empty = document.createElement('textarea')
      const checkbox = document.createElement('input')
      checkbox.type = 'checkbox'
      expect(is_typing(focused(empty))).toBe(false)
      expect(is_typing(focused(checkbox))).toBe(false)
      expect(is_typing(focused(null))).toBe(false)
    })
  })
})
