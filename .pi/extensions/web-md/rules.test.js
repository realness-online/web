import { test } from 'node:test'
import assert from 'node:assert/strict'
import { check } from './rules.js'

const W = '/x/bin/web-md.js'
const blocked = cmd => assert.ok(check(cmd, W), `should block: ${cmd}`)
const allowed = cmd => assert.equal(check(cmd, W), null, `should allow: ${cmd}`)

test('blocks curl page reads seen in fresh sessions', () => {
  blocked(`curl -sL https://example.com | sed -e 's/<[^>]*>//g'`)
  blocked(`curl -s https://news.ycombinator.com | grep -o '<span class="titleline">'`)
  blocked(`curl -sL "https://en.wikipedia.org/w/index.php?title=Markdown&action=raw" | grep -i swartz`)
  blocked(`curl -sL https://nodejs.org/api/fs.html | grep -oE 'Node.js v[0-9.]+'`)
  blocked(`cd /tmp && curl -sL https://firecracker-microvm.github.io | grep -i timeout`)
})

test('reason names web-md and the url', () => {
  const reason = check('curl -s https://example.com', W)
  assert.match(reason, /\/x\/bin\/web-md\.js 'https:\/\/example\.com'/)
  assert.match(reason, /# web-md: skip/)
})

test('allows APIs, downloads, and local servers', () => {
  allowed('curl -s https://api.github.com/repos/mozilla/readability | jq .stargazers_count')
  allowed('curl -sL https://registry.npmjs.org/turndown')
  allowed('curl -X POST https://example.com/hook -d "{}"')
  allowed('curl -sLo node.tar.gz https://nodejs.org/dist/v24/node.tar.gz')
  allowed('curl -I https://example.com')
  allowed('curl -s http://localhost:8080/health')
  allowed('curl -s https://raw.githubusercontent.com/a/b/main/README.md')
  allowed('curl -H "Authorization: Bearer x" https://example.com/me')
  allowed('curl -s https://www.reddit.com/r/vim.json')
})

test('allows web-md itself and the skip comment', () => {
  allowed('/x/bin/web-md.js https://example.com --max 4000')
  allowed('curl -s https://example.com # web-md: skip')
})

test('blocks agent-browser whole-page dumps', () => {
  blocked('agent-browser --session s get text body')
  blocked('agent-browser get html html | head -c 5000')
  blocked('agent-browser --session s get text')
})

test('allows agent-browser interaction', () => {
  allowed('agent-browser --session s open https://example.com')
  allowed('agent-browser --session s snapshot -i')
  allowed('agent-browser --session s click @e3')
  allowed('agent-browser --session s get text @e5')
  allowed('agent-browser --session s screenshot out.png')
  allowed('agent-browser get text body # web-md: skip')
})

test('ignores commands without urls', () => {
  allowed('ls -la')
  allowed('grep -rn curl extensions')
})
