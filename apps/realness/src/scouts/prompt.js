import { RESEARCH_MIN } from './leads.js'
import { source_patterns, source_urls } from './sources.js'

const FIND_SHAPE = `<article itemscope itemtype="/find"><dl>
<dt>url</dt><dd><a itemprop="url" href="https://...">https://...</a></dd>
<dt>title</dt><dd><span itemprop="title">...</span></dd>
<dt>org</dt><dd><span itemprop="org">...</span></dd>
<dt>source</dt><dd><span itemprop="source">VueJobs</span></dd>
<dt>score</dt><dd><span itemprop="score">8</span></dd>
<dt>reason</dt><dd><span itemprop="reason">one line</span></dd>
<dt>node</dt><dd><span itemprop="node"></span></dd>
<dt>research</dt><dd><span itemprop="research">[[acme]]</span></dd>
<dt>draft</dt><dd><span itemprop="draft">the note, or empty</span></dd>
</dl></article>`

/**
 * The whole brief one run gets: the profile, the sources, where to write, and
 * the record the harness reads back. A lead already on the finds page is code's
 * job to drop, so the brief never carries the list.
 * @param {object} run
 * @param {string} run.label
 * @param {string} run.profile
 * @param {string} run.sources
 * @param {{ id: string, goal: string }[]} run.nodes the plan's open nodes
 * @param {string} run.run_dir
 * @param {string} run.vault_dir
 * @param {string} run.folder the scout's vault folder
 * @param {{ title: string, text: string } | null} [run.source] the one source this run reads
 */
export const scout_prompt = ({
  label,
  profile,
  sources,
  source = null,
  nodes,
  run_dir,
  vault_dir,
  folder
}) => {
  const text = source ? source.text : sources
  const named = source_urls(text)
  const patterns = source_patterns(text)
  const pages = named.filter(
    url => !url.includes('<') && !patterns.some(one => one.startsWith(url))
  )
  const site = text.match(/--site ([a-z0-9-]+)/)?.[1]
  const read = site
    ? `realness-read --site ${site} --brief <url>`
    : 'realness-read <url>'
  return `You are the ${label} scout. You run alone: nobody answers a question, so never ask one.
Work this one source until the leads are in, then stop.

# The profile

Everything is scored against this. Do not invent a rule it does not hold.

${profile.trim()}

# The sources

${
  source
    ? `This run reads one source: ${source.title}. Another run reads each of the others.
Read it alone, and stop when it gives no new lead.`
    : `Work through these in order. A source that fails or needs a login you do not
have is a line in your summary, not a reason to stop. A source behind a Chrome
lease is the exception: when \`realness chrome lease\` fails, say so and stop;
the run is dead either way.`
}

${sources.trim()}

# The plan's open nodes

Every lead should help one of these. Name its id in the lead's \`node\`.

${nodes.length ? nodes.map(node => `${node.id}: ${node.goal}`).join('\n') : '(none open)'}

# What to do

${
  pages.length
    ? `1. \`realness-read\` is installed and ready. Run \`${read}\` on each
   page below.

${pages.map(url => `   - ${url}`).join('\n')}${
        patterns.length
          ? `

   You may also read pages that fit these patterns, and no others:

${patterns.map(url => `   - ${url}`).join('\n')}`
          : ''
      }`
    : `1. This source names no page. Run the command the source names, if it names
   one, and nothing else. The source is the whole run.`
}
2. Score every posting on those pages with the profile's rubric, 0 to 10, with a
   one-line reason. Use only what those pages say.
3. Write ${run_dir}/finds.html once, one item per lead, exactly this shape.
   Writing it ends the run.
4. A page that will not read, a source with nothing in it, or a source where no
   one fits, is a sentence on the page itself. Write finds.html with no items,
   say why in one sentence, and stop. Never write an item that is not a lead.

Read only the pages above. Any other page ends the run at once.

${FIND_SHAPE}

   \`score\` is a number 0 to 10. \`node\` is the id of the open node it helps, or empty.
   \`research\` is the wikilink to the company note, or empty. \`draft\` is the
   text, or empty. Write every value as text with &, <, >, and " as
   &amp; &lt; &gt; &quot;. Never write JSON.

# The end

The harness writes the report note from finds.html. Do not write one.
A run with no finds.html wrote nothing, so write it first.
After you write it, finish with a short summary: how many leads, how many above ${RESEARCH_MIN}, which
sources failed, and anything the profile does not decide.`
}
