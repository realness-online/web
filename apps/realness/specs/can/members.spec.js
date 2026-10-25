import { it } from 'node:test'
import assert from 'node:assert/strict'
import { members_html, read_members } from '../../src/can/members.js'

const A = '+14155550001'
const B = '+14155550002'
const PERSON = 'itemscope itemtype="https://schema.org/Person"'
const page = inner =>
  `<!doctype html><article itemscope itemtype="https://schema.org/Organization">
    <h1 itemprop="name">Family</h1>${inner}</article>`
const person = (prop, phone, name, tag = 'p') =>
  `<${tag} itemprop="${prop}" ${PERSON}><span itemprop="name">${name}</span>
    <span itemprop="telephone">${phone}</span></${tag}>`

it('reads the founder and members from displayed telephones', () => {
  const org = read_members(
    page(`${person('founder', A, 'Scott')}
      <ul>${person('member', B, 'Ava', 'li')}</ul>`)
  )
  assert.equal(org.founder, A)
  assert.deepEqual(org.members, [A, B])
  assert.deepEqual(org.people, [
    { role: 'founder', phone: A, name: 'Scott' },
    { role: 'member', phone: B, name: 'Ava' }
  ])
})

it('a number may be shown with spaces, dashes, dots, and parentheses', () => {
  const org = read_members(page(person('founder', '+1 (415) 555-0001', 'S')))
  assert.equal(org.founder, A)
})

it('a telephone whose value would come from an attribute is refused', () => {
  for (const hidden of [
    `<a itemprop="telephone" href="tel:${B}">${A}</a>`,
    `<data itemprop="telephone" value="${B}">${A}</data>`,
    `<meta itemprop="telephone" content="${B}">`,
    `<time itemprop="telephone" datetime="${B}">${A}</time>`
  ])
    assert.throws(() =>
      read_members(page(`<p itemprop="founder" ${PERSON}>${hidden}</p>`))
    )
})

it('markup inside a telephone is refused', () => {
  assert.throws(() =>
    read_members(
      page(
        `<p itemprop="founder" ${PERSON}><span itemprop="telephone"><b>${A}</b></span></p>`
      )
    )
  )
})

it('a founder or member must be a Person with exactly one telephone', () => {
  assert.throws(() =>
    read_members(
      page(`<p itemprop="founder"><span itemprop="telephone">${A}</span></p>`)
    )
  )
  assert.throws(() =>
    read_members(page(`<p itemprop="founder" ${PERSON}>Scott</p>`))
  )
  assert.throws(() =>
    read_members(
      page(
        `<p itemprop="founder" ${PERSON}><span itemprop="telephone">${A}</span><span itemprop="telephone">${B}</span></p>`
      )
    )
  )
})

it('a commented-out member is removed', () => {
  const org = read_members(
    page(`${person('founder', A, 'Scott')}
      <!-- ${person('member', B, 'Ava')} -->`)
  )
  assert.deepEqual(org.members, [A])
})

it('throws on a missing or second founder, a bad number, or a script', () => {
  assert.throws(() => read_members(page('')))
  assert.throws(() =>
    read_members(page(person('founder', A, 'a') + person('founder', B, 'b')))
  )
  assert.throws(() => read_members(page(person('founder', 'Scott', 'a'))))
  assert.throws(() =>
    read_members(page(person('founder', A, 'a') + '<script></script>'))
  )
  assert.throws(() => read_members(page(`<p itemprop="founder" ${PERSON}>`)))
})

it('a page sync writes reads back the same, names escaped', () => {
  const html = members_html({
    name: '+family',
    founder: { name: 'Scott', phone: A },
    members: [{ name: 'Ava <3 & co', phone: B }, { phone: A }]
  })
  assert.match(html, /Ava &lt;3 &amp; co/)
  const org = read_members(html)
  assert.equal(org.founder, A)
  assert.deepEqual(org.members, [A, B])
  assert.equal(org.people[1].name, 'Ava <3 & co')
  assert.throws(() => members_html({ name: '+x', founder: { phone: 'nope' } }))
})
