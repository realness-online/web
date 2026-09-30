import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { is_typing, watch_for_updates } from '@/use/reload-on-update'

/** A service worker container: an event target with a controller. */
const fake_workers = controlled => {
  const workers = new EventTarget()
  const update = vi.fn(async () => {})
  Object.assign(workers, {
    controller: controlled ? {} : null,
    getRegistration: vi.fn(async () => ({ update }))
  })
  return { workers, update }
}

/** A document whose visibility and focus the test sets. */
const fake_doc = () => {
  const doc = new EventTarget()
  Object.assign(doc, { visibilityState: 'visible', activeElement: null })
  return doc
}

const show = doc => {
  doc.visibilityState = 'visible'
  doc.dispatchEvent(new Event('visibilitychange'))
}
const hide = doc => {
  doc.visibilityState = 'hidden'
  doc.dispatchEvent(new Event('visibilitychange'))
}
const take_over = workers =>
  workers.dispatchEvent(new Event('controllerchange'))

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

  it('reloads once hidden after a new worker takes over', () => {
    const { workers } = fake_workers(true)
    const doc = fake_doc()
    start(workers, doc)
    take_over(workers)
    expect(reload).not.toHaveBeenCalled()
    hide(doc)
    expect(reload).toHaveBeenCalledTimes(1)
  })

  it('leaves the page alone without a takeover', () => {
    const { workers } = fake_workers(true)
    const doc = fake_doc()
    start(workers, doc)
    hide(doc)
    expect(reload).not.toHaveBeenCalled()
  })

  it('ignores the first install, but not an update after it', () => {
    const { workers } = fake_workers(false)
    const doc = fake_doc()
    start(workers, doc)
    take_over(workers)
    hide(doc)
    expect(reload).not.toHaveBeenCalled()
    take_over(workers)
    hide(doc)
    expect(reload).toHaveBeenCalledTimes(1)
  })

  it('waits while anything is working, then reloads on a later hide', () => {
    const { workers } = fake_workers(true)
    const doc = fake_doc()
    start(workers, doc)
    take_over(workers)
    working = true
    hide(doc)
    expect(reload).not.toHaveBeenCalled()
    working = false
    show(doc)
    hide(doc)
    expect(reload).toHaveBeenCalledTimes(1)
  })

  it('waits while a statement is half typed', () => {
    const { workers } = fake_workers(true)
    const doc = fake_doc()
    const textarea = document.createElement('textarea')
    textarea.value = 'half a thou'
    doc.activeElement = textarea
    start(workers, doc)
    take_over(workers)
    hide(doc)
    expect(reload).not.toHaveBeenCalled()
    textarea.value = ''
    show(doc)
    hide(doc)
    expect(reload).toHaveBeenCalledTimes(1)
  })

  it('looks for a new worker whenever the page comes back', async () => {
    const { workers, update } = fake_workers(true)
    const doc = fake_doc()
    start(workers, doc)
    hide(doc)
    show(doc)
    await vi.waitFor(() => expect(update).toHaveBeenCalledTimes(1))
  })

  it('stops listening', () => {
    const { workers } = fake_workers(true)
    const doc = fake_doc()
    start(workers, doc)
    stop()
    take_over(workers)
    hide(doc)
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
