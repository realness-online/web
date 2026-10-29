/**
 * Read an org's members page, `orgs/+name/members.html`.
 *
 * The page is plain, readable HTML. Each person is a Schema.org Person whose
 * telephone is its displayed text, as microdata reads it:
 *
 *   <article itemscope itemtype="https://schema.org/Organization">
 *     <h1 itemprop="name">Family</h1>
 *     <p itemprop="founder" itemscope itemtype="https://schema.org/Person">
 *       <span itemprop="name">Scott</span> <span itemprop="telephone">+1 628-228-1824</span>
 *     </p>
 *     <ul>
 *       <li itemprop="member" itemscope itemtype="https://schema.org/Person">
 *         <span itemprop="name">Ava</span> <span itemprop="telephone">+1 415 555 0002</span>
 *       </li>
 *     </ul>
 *   </article>
 *
 * What the page shows is what admits: a telephone must sit on an element
 * whose microdata value is its text, never on `a`, `data`, `meta`, and the
 * like, whose value would come from an attribute. Spaces, dashes, dots, and
 * parentheses in the number are ignored. Comments are dropped, so a
 * commented-out member is removed. The founder is always a member.
 * Anything unclear throws; the caller denies.
 */

const PERSON = 'https://schema.org/Person'
/** A member may also be written as `employee`: the same thing, now microdata's word. */
const MEMBER = 'employee'
const PHONE = /^\+[1-9]\d{6,14}$/
const VOID = new Set([
  'br',
  'hr',
  'img',
  'input',
  'link',
  'meta',
  'source',
  'wbr'
])
/** Elements whose microdata value is an attribute, not their text. */
const ATTRIBUTE_VALUED = new Set([
  'a',
  'area',
  'audio',
  'data',
  'embed',
  'iframe',
  'img',
  'link',
  'meter',
  'meta',
  'object',
  'source',
  'time',
  'track',
  'video'
])
const TOKEN =
  /<(\/?)([a-zA-Z][\w-]*)((?:\s+[^\s=/>]+(?:\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+))?)*)\s*(\/?)>|([^<]+)/g
const ATTR = /([^\s=/>]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+)))?/g

const attributes = text => {
  const found = {}
  for (const [, name, a, b, c] of text.matchAll(ATTR))
    found[name.toLowerCase()] = a ?? b ?? c ?? ''
  return found
}

const ENTITIES = { amp: '&', lt: '<', gt: '>', quot: '"', '#39': "'" }
const unescape = text =>
  text.replace(/&(amp|lt|gt|quot|#39);/g, (_, entity) => ENTITIES[entity])

/** A displayed number as `+digits`, or throws. */
const phone_of = text => {
  const phone = text.replace(/[\s().-]/g, '')
  if (!PHONE.test(phone))
    throw new Error(`members page: "${text.trim()}" is not a phone number`)
  return phone
}

/** Ends a field or a person when its element closes. */
const close_tag = (state, name) => {
  if (VOID.has(name)) return
  const { stack, phone, person } = state
  const top = stack.pop()
  if (top !== name) throw new Error(`members page: </${name}> closes <${top}>`)
  if (phone && stack.length === phone.depth) {
    if (phone.field === 'name') person.names.push(unescape(phone.text.trim()))
    else person.phones.push(phone_of(phone.text))
    state.phone = null
  }
  if (person && stack.length === person.depth) {
    if (person.phones.length !== 1)
      throw new Error(`members page: a ${person.prop} needs one telephone`)
    state.found[person.prop].push(person.phones[0])
    state.people.push({
      role: person.prop,
      phone: person.phones[0],
      name: person.names[0] ?? ''
    })
    state.person = null
  }
}

/** Starts a person or one of its fields when an element opens. */
const open_tag = (state, name, a, self) => {
  const empty = VOID.has(name) || self
  const props = (a.itemprop ?? '').toLowerCase().split(/\s+/)
  const role = ['founder', 'member', MEMBER].find(prop => props.includes(prop))
  const field = ['telephone', 'name'].find(prop => props.includes(prop))
  if (role) {
    if (state.person) throw new Error('members page: a person inside a person')
    if (!('itemscope' in a) || a.itemtype !== PERSON || 'itemref' in a)
      throw new Error(`members page: ${role} must be a Person`)
    if (empty) throw new Error(`members page: empty ${role}`)
    state.person = {
      prop: role,
      depth: state.stack.length,
      phones: [],
      names: []
    }
  } else if (state.person && field) {
    if (state.phone)
      throw new Error(`members page: ${field} inside ${state.phone.field}`)
    if (ATTRIBUTE_VALUED.has(name) || empty)
      throw new Error(`members page: ${field} on <${name}> hides its value`)
    state.phone = { depth: state.stack.length, text: '', field }
  } else if (state.phone)
    throw new Error('members page: markup inside a telephone')
  if (!empty) state.stack.push(name)
}

/**
 * One person on a members page, as shown.
 * @typedef {{ role: string, phone: string, name: string }} Member
 */

/** `{ founder, members, people }` from the page's text; `people` keeps each
 * shown name, so sync can write the page again.  Throws on a malformed page. */
export const read_members = source => {
  if (typeof source !== 'string') throw new Error('members page is not text')
  const html = source.replace(/<!--[\s\S]*?(?:-->|$)/g, '')
  if (/<(script|style|template|textarea)\b/i.test(html))
    throw new Error('members page: raw or inert content')
  /** @type {{ found: Record<string, string[]>, stack: string[], people: Member[], person: { prop: string, depth: number, phones: string[], names: string[] } | null, phone: { depth: number, text: string, field: string } | null }} */
  const state = {
    found: { founder: [], member: [], employee: [] },
    stack: [],
    people: [],
    person: null,
    phone: null
  }
  for (const [, closing, raw, attrs, self, text] of html.matchAll(TOKEN))
    if (text !== undefined) {
      if (state.phone) state.phone.text += text
    } else if (closing) close_tag(state, raw.toLowerCase())
    else open_tag(state, raw.toLowerCase(), attributes(attrs), self)

  const { found, stack, people, person, phone } = state
  if (person || phone || stack.length)
    throw new Error('members page: unclosed element')
  if (found.founder.length !== 1)
    throw new Error('members page: need exactly one founder')
  const [founder] = found.founder
  return {
    founder,
    members: [...new Set([founder, ...found.member, ...found.employee])],
    people
  }
}

/**
 * The page's people, or nobody when the page cannot be read.
 * @param {unknown} source
 * @returns {Member[]}
 */
export const read_people = source => {
  try {
    return read_members(source).people
  } catch {
    return []
  }
}

const escape = text =>
  String(text).replace(
    /[&<>"]/g,
    char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[char]
  )

const person_html = (role, { name = '', phone }, tag) =>
  `<${tag} itemprop="${role}" itemscope itemtype="${PERSON}">${
    name ? `<span itemprop="name">${escape(name)}</span> ` : ''
  }<span itemprop="telephone">${phone}</span></${tag}>`

/**
 * A members page sync writes: the org's name, its founder, and each member,
 * every value shown as text. Reads back with read_members.
 * @param {{ name: string, founder: { name?: string, phone: string }, members?: { name?: string, phone: string }[] }} org
 */
export const members_html = ({ name, founder, members = [] }) => {
  for (const { phone } of [founder, ...members])
    if (!PHONE.test(phone)) throw new Error(`members page: bad phone ${phone}`)
  const others = members.filter(({ phone }) => phone !== founder.phone)
  return `<!doctype html>
<html lang="en">
<head><meta charset="utf-8"><title>${escape(name)} members</title></head>
<body>
<article itemscope itemtype="https://schema.org/Organization">
<h1 itemprop="name">${escape(name)}</h1>
<p>Founder: ${person_html('founder', founder, 'span')}</p>
<ul>
${others.map(person => `<li>${person_html('member', person, 'span')}</li>`).join('\n')}
</ul>
</article>
</body>
</html>
`
}
