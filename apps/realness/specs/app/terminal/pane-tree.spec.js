import { describe, expect, it } from 'vite-plus/test'
import {
  from_saved,
  places,
  remove_pane,
  sessions,
  split_at,
  toward
} from '@/terminal/pane-tree.js'

const one = { session: null }

describe('@/terminal/pane-tree', () => {
  it('splits the focused pane, not the whole layout', () => {
    const right = split_at(one, null, 'row', 'p1')
    const below = split_at(right, 'p1', 'column', 'p2')
    expect(sessions(below)).toEqual([null, 'p1', 'p2'])
    const at = places(below)
    expect(at.get(null)).toEqual({ top: 0, left: 0, width: 50, height: 100 })
    expect(at.get('p1')).toEqual({ top: 0, left: 50, width: 50, height: 50 })
    expect(at.get('p2')).toEqual({ top: 50, left: 50, width: 50, height: 50 })
  })

  it('minus below the first pane after a right split stacks only that pane', () => {
    const tree = split_at(
      split_at(one, null, 'row', 'p1'),
      null,
      'column',
      'p2'
    )
    const at = places(tree)
    expect(at.get(null)).toEqual({ top: 0, left: 0, width: 50, height: 50 })
    expect(at.get('p2')).toEqual({ top: 50, left: 0, width: 50, height: 50 })
    expect(at.get('p1')).toEqual({ top: 0, left: 50, width: 50, height: 100 })
  })

  it('closing a pane gives its space to its sibling', () => {
    const tree = split_at(
      split_at(one, null, 'row', 'p1'),
      'p1',
      'column',
      'p2'
    )
    const left = remove_pane(tree, 'p2')
    expect(places(left).get('p1')).toEqual({
      top: 0,
      left: 50,
      width: 50,
      height: 100
    })
    expect(sessions(remove_pane(left, 'p1'))).toEqual([null])
  })

  it('restores a saved tree, an older flat list, or one pane', () => {
    const tree = split_at(one, null, 'column', 'p1')
    expect(from_saved({ tree })).toEqual(tree)
    expect(
      sessions(
        from_saved({
          panes: [{ session: null }, { session: 'p1' }, { session: 'p2' }],
          direction: 'column'
        })
      )
    ).toEqual([null, 'p1', 'p2'])
    for (const untrusted of [
      null,
      { panes: [{ session: 'p1' }] },
      { panes: 'not a list' },
      { tree: { split: 'sideways', a: one, b: { session: 'p1' } } },
      { tree: { split: 'row', a: { session: 'p1' }, b: { session: 'p1' } } }
    ])
      expect(from_saved(untrusted)).toEqual(one)
  })
  it('arrows move to the pane on that side, and stay put at an edge', () => {
    const tree = split_at(
      split_at(one, null, 'row', 'p1'),
      'p1',
      'column',
      'p2'
    )
    expect(toward(tree, null, 'right')).toBe('p1')
    expect(toward(tree, 'p1', 'down')).toBe('p2')
    expect(toward(tree, 'p2', 'up')).toBe('p1')
    expect(toward(tree, 'p2', 'left')).toBe(null)
    expect(toward(tree, null, 'left')).toBe(undefined)
    expect(toward(tree, 'p1', 'right')).toBe(undefined)
  })
})
