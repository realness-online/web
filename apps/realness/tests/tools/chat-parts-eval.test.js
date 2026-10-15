import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  cards_draw,
  form_of,
  pooled
} from '../../frontend/scripts/chat-parts-eval.js'

describe('form_of', () => {
  it('names a diagram, a card, a table, and plain text', () => {
    assert.equal(form_of('```mermaid\nflowchart LR\n a --> b\n```'), 'diagram')
    assert.equal(form_of('```cardlink\nhttps://example.com\n```'), 'card')
    assert.equal(form_of('| a | b |\n| --- | --- |\n| 1 | 2 |'), 'table')
    assert.equal(form_of('just a sentence'), 'text')
  })

  it('reads a fence whatever its case', () => {
    assert.equal(form_of('```Mermaid\nx\n```'), 'diagram')
    assert.equal(form_of('```CardLink\nx\n```'), 'card')
  })

  it('wants a delimiter row before it calls something a table', () => {
    assert.equal(form_of('| a | b |\n| 1 | 2 |'), 'text')
  })

  it('prefers the first fence when a reply has more than one kind', () => {
    assert.equal(
      form_of('```mermaid\nx\n```\n\n```cardlink\ny\n```'),
      'diagram'
    )
  })

  it('answers text for an empty reply', () => {
    assert.equal(form_of(''), 'text')
  })
})

describe('cards_draw', () => {
  it('is true when there is no card at all', () => {
    assert.equal(cards_draw('plain words'), true)
  })

  it('is true when every card fence draws a card', () => {
    const reply = [
      '```cardlink',
      'title: Example',
      'url: https://example.com',
      '```'
    ].join('\n')
    assert.equal(cards_draw(reply), true)
  })

  it('draws a card from a url alone, but not from an empty fence', () => {
    assert.equal(cards_draw(['```cardlink', '```'].join('\n')), false)
    assert.equal(
      cards_draw(['```cardlink', 'url: https://example.com', '```'].join('\n')),
      true
    )
  })

  it('is false when one of two card fences cannot draw', () => {
    const reply = [
      '```cardlink',
      'title: One',
      'url: https://example.com/one',
      '```',
      '```cardlink',
      '```'
    ].join('\n')
    assert.equal(cards_draw(reply), false)
  })
})

describe('pooled', () => {
  it('runs every job and keeps the results in order', async () => {
    const order = []
    const jobs = [1, 2, 3, 4, 5].map(value => async () => {
      order.push(value)
      return value * 2
    })
    assert.deepEqual(await pooled(jobs, 2), [2, 4, 6, 8, 10])
    assert.equal(order.length, 5)
  })

  it('answers an empty list for no jobs', async () => {
    assert.deepEqual(await pooled([], 4), [])
  })

  it('still runs every job when there are more than the pool size', async () => {
    let started = 0
    const jobs = Array.from({ length: 9 }, () => async () => {
      started += 1
      return started
    })
    const results = await pooled(jobs, 3)
    assert.equal(results.length, 9)
    assert.equal(started, 9)
  })
})
