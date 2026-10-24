---
name: critic
description: Verification-first habit for realness. Run cheap deterministic checks before expensive or final steps; never let the producer grade its own homework. Use on every task before calling work done - structural checks (does it build, do the tests pass, is the expected item present) before any LLM judge, cost-heavy review, or user sign-off.
metadata:
  check: "node ../../bin/checks/check-skills.js critic"
---

# Critic

Most errors are caught by cheap checks. Order all verification cheapest-first so expensive confidence only runs on survivors.

## Hierarchy

1. **Deterministic / structural** (free, always run): does it build, does `npm run test` pass, is the expected output actually present, did the file write. For code, also run the project's checks and `node .pi/bin/checks/soundness-check.js <touched paths>` - the mechanically decidable rules, judged by the script, not the producer. Run `node .pi/bin/checks/comment-check.js <touched paths>` to prove no comment crept back. Check the thing the task promised, programmatically where possible.
2. **Cheap review**: read your own diff/output once, against the goal, and state plainly what is missing or wrong. For code, this is where `soundness`'s prose rules get judged - module boundaries, selector choice, invented wrappers, escaping at output boundaries, dependency choice. The checker prints the list it did not decide.
3. **Expensive judgment** (only if the cheap tiers passed): LLM-style quality review, cross-checking choices, art direction. Spend tokens only on survivors.

## Rules

- Always run the cheap tier first; a failing cheap check is the next thing to fix.
- The producer never grades its own homework - for anything that matters, review from evidence, not from intent.
- If an expensive check would be skipped under pressure, say so instead of quietly dropping verification.
- One failing check is a reason to stop and fix, not to proceed and note it.
- Comments are JSDoc or a tool directive, nothing else. State a reason in JSDoc on the function; do not add an explanatory comment. Run `check:comments` and clear every hit.

## Related

- `soundness` - the standard for code. The checker covers three decidable rules; the review covers the rest.
- `node .pi/bin/checks/comment-check.js` - the comment rule. JSDoc, LuaDoc, rustdoc, and tool directives pass; everything else fails.
