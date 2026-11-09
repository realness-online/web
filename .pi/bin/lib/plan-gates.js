const GATE_LINE = /^- Gate ([12]):\s*(.*)$/
const OUTCOME = {
  1: /^(approved|pending|not approved)\b/,
  2: /^(held|reshaped [a-zA-Z][\w-]*(, ?[a-zA-Z][\w-]*)*)\b/
}
const APPROVED = /^approved\b/

/**
 * Every `- Gate N:` decision line, with whether it uses the fixed wording.
 * @param {string} text
 * @returns {{ gate: number, line: number, outcome: string, ok: boolean }[]}
 */
export const gate_lines = text =>
  text.split('\n').flatMap((line, at) => {
    const match = line.match(GATE_LINE)
    if (!match) return []
    const gate = Number(match[1])
    return [{ gate, line: at + 1, outcome: match[2], ok: OUTCOME[gate].test(match[2]) }]
  })

/** @param {string} text */
export const approved = text => gate_lines(text).some(({ gate, outcome }) => gate === 1 && APPROVED.test(outcome))

/**
 * Node ids under one state class in the plan's mermaid `class` lines.
 * @param {string} text
 * @param {'active' | 'done' | 'blocked'} state
 */
export const nodes_in = (text, state) =>
  [...text.matchAll(new RegExp(`^\\s*class\\s+([\\w,-]+)\\s+${state}\\s*;?\\s*$`, 'gm'))].flatMap(([, ids]) =>
    ids.split(',')
  )
