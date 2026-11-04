const rubric = `# Review

You review a change another engineer made. You have not seen their reasoning; judge the code, not the intent. Read the \`critic\` and \`soundness\` skills first; they set the standard, and the project's own checks run before you.

## What to flag

- Only what this change introduced. Pre-existing problems stay out.
- Discrete, actionable issues the author would fix if they knew.
- Impact you can show in the code. Do not speculate about other parts.
- Untrusted input: unchecked redirects, unparametrized SQL, fetches of user URLs that can reach local resources, sanitizing where escaping fits.
- Errors handled locally that should surface: a \`catch\` that returns \`null\`, \`[]\`, or \`false\`, or logs and continues.

## Findings

Tag each finding in its title:

- [P0] Blocks release or operation, whatever the input.
- [P1] Fix in the next cycle.
- [P2] Fix eventually.
- [P3] Nice to have.

For each: tag, \`path:line\` (at most 10 lines), why it matters, what to change. One short paragraph. No praise.

End with a verdict, "correct" or "needs attention", then this section:

## Human callouts

Only the lines that apply, else "- (none)":

- **Adds a database migration:** <details>
- **Adds or changes a dependency or lockfile:** <details>
- **Changes auth or permissions:** <details>
- **Breaks a public schema, API, or contract:** <details>
- **Runs irreversible or destructive operations:** <details>`

export const summary_prompt = `We are leaving a code-review branch and returning to the work branch. Write a handoff to act on at once. Keep every finding.

## Scope
What was reviewed.

## Verdict
"correct" or "needs attention".

## Findings
Each: [P0]-[P3] tag and title, \`path:line\`, why it matters, what to change.

## Fix queue
Ordered checklist, highest priority first.

## Human callouts
The applicable callouts, or "- (none)".`

/**
 * @typedef {{ type: 'session', paths: string[] } | { type: 'uncommitted' } | { type: 'commit', sha: string } | { type: 'branch', branch: string, base: string }} ReviewTarget
 */

/**
 * The full review prompt for a target.
 * @param {ReviewTarget} target
 */
export const review_prompt = target => {
  const focus = {
    session: () =>
      `Review the uncommitted changes to these files, which one session made. Other files also have uncommitted changes; leave them out. Use \`git diff HEAD -- <file>\`, and read new files whole.\n\n${
        target.type === 'session' ? target.paths.map(path => `- ${path}`).join('\n') : ''
      }`,
    uncommitted: () =>
      'Review the current changes: staged, unstaged, and untracked. Use `git status --porcelain`, `git diff HEAD`, and `git ls-files --others --exclude-standard`.',
    commit: () =>
      `Review the changes commit ${target.type === 'commit' ? target.sha : ''} introduced. Use \`git show\`.`,
    branch: () =>
      target.type === 'branch'
        ? `Review the changes against branch '${target.branch}'. The merge base is ${target.base}; use \`git diff ${target.base}\`.`
        : ''
  }[target.type]()
  return `${rubric}\n\n---\n\n${focus}`
}

/**
 * The entry a review branch returns to, when the current branch is one.
 * @param {any[]} branch
 * @returns {string | undefined}
 */
export const review_origin = branch =>
  branch.findLast(entry => entry.type === 'custom' && entry.customType === 'review-session')?.data?.origin
