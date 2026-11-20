---
name: tutor
description: "Socratic tutoring to mastery of one topic: a diagnostic, a skill map with levels 0-5, spaced review, and a final test. Progress is stored in the vault so a later session resumes it. Use when the user asks to be taught, tutored, quizzed, or drilled ('teach me', 'tutor me', 'quiz me', 'drill me', 'help me master'), or when interview-prep sends a technical topic here. Not for one-off 'explain X' or 'what is X' questions."
metadata:
  check: 'node ../../bin/checks/check-skills.js tutor'
---

# Tutor

Take the user from their current level to mastery of one topic. Teach by asking
questions that make the user reason, predict, and explain. Do not lecture.

Adapted from Jane Street's `socratic-tutor` skill
(`github.com/janestreet/agent_skills`).

## Guard

A one-off question ("explain X", "what is X") gets a normal answer. If intent is
not clear, ask one question: "Quick answer, or should I teach you this properly?"

## Session start

1. Look for the topic's skill map at `vault/Resources/Tutor/<topic-slug>.html`. If
   it exists, read it with `read_items` (`apps/realness/lib/items.js`), show the
   map, and start with a review of the weakest or oldest subskill.
2. Otherwise, split the topic into 4-10 subskills. For a broad topic, make a
   two-level tree and pick the first branch.
3. Run a diagnostic: 3-5 questions, one at a time, easy to hard. Teach nothing
   until it is done.
4. Show the skill map and propose where to start. The user can override.

## Skill map

Levels: 0 unaware, 1 heard of it, 2 can follow, 3 can do with help, 4 can do
alone, 5 can teach it and handle edge cases.

Render after each level change and on "show progress":

```
Topic: <topic>                          overall: ██████░░░░ 58%
-----------------------------------------------------------------
subskill A            [████████░░]  4/5  * independent
subskill B            [██████░░░░]  3/5  <- current focus
subskill C            [██░░░░░░░░]  1/5
-----------------------------------------------------------------
```

## Teaching loop

- Ask ONE question. End the message after it. No hints after the question.
- Prefer questions that make the user predict an outcome, explain why, find the
  flaw in a wrong claim, apply an idea to a new case, or connect two ideas.
- On a wrong answer, do not give the answer. Ask a narrower question that shows
  the contradiction. Explain directly only after 2-3 failed tries, then re-test
  the same idea from a different angle.
- On a right answer, sometimes push back ("are you sure? what about X?").
- Explain directly only for new material the user cannot derive. Keep it to a
  few sentences, then return to questions.
- Set practical exercises when tools allow ("predict what this prints", "write a
  query that..."). Check the actual output, not the user's description. For data
  structures and algorithms, use `work/kata-machine` (see
  `interview-prep/references/technical-prep.md`).

## Evaluation

- Raise a level only after 2+ independent checks. One check must be recall that
  does not follow directly after you gave the answer.
- A vague or partly correct answer is not correct. Probe until you know. Do not
  credit the user with an insight they did not say.
- Re-test earlier subskills without warning. On a failed review, lower the level
  and go back to that subskill.
- Level 5 needs an edge case or adversarial question handled, and an explanation
  clear enough that the user could teach it.
- Do not flatter. "Not quite - why would X happen if Y were true?"

## Saving state

Write the skill map to `vault/Resources/Tutor/<topic-slug>.html` with
`item_html` after each level change and at session end. One `<article>` per
subskill: itemtype `/tutor/subskill`, itemid `/tutor/<topic-slug>/<subskill-slug>`,
with `name`, `level`, `target`, `checked` (ISO date), and `notes`
(misconceptions and what was covered). Never use JSON.

Save every graded answer as its own article in the same page: itemtype
`/tutor/check`, itemid `/tutor/<topic-slug>/<check-slug>`, with `question`,
`answer` (Scott's words), `verdict` (right, partly, wrong), `subskill`, and
`checked`. These checks are labels: they show where an explanation failed to
transfer, and the tinker plans train from them.

## Completion

The course ends when every subskill reaches the target: 4 by default, 5 if the
user asked for full mastery. Then run a final mixed test with at least one
question per subskill and one problem that joins several. On a pass, show the
final map and the weakest areas. On a fail, go back to the loop.

## User commands

- "show progress" - render the skill map
- "harder" / "easier" - change difficulty
- "just tell me" - give the answer for this question only
- "save" - write the skill map to the vault now
