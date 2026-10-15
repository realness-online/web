---
description: Start or resume autoresearch in a Realness VM
argument-hint: "<goal and project details>"
---

Use the autoresearch-create skill.

Research request: $ARGUMENTS

Determine the project path, goal, primary metric and unit, optimization
direction, benchmark command, allowed files, and constraints from this request
and the project. If a required detail is missing, ask one short question.

Check the available experiment tools and project scripts first.
If a required tool or metric is missing, stop and report it.

Preserve behavior, pass existing tests, and add no dependencies unless approved.
Work on a dedicated autoresearch branch. Preserve existing local changes.
Keep all experiment files in the project's .auto/ directory.

If a session exists, read its prompt, log, and ideas, then resume.
Otherwise, create the benchmark and correctness checks, initialize the
session, and measure a baseline. Do not initialize an existing session again
unless its optimization target changes.

Run one change per experiment. Use run_experiment, then log_experiment for
every result. Keep verified primary-metric improvements. Discard regressions
or unchanged results. Log failed correctness checks as checks_failed.
Include asi with every result: the hypothesis, what you learned, and, for
failed or discarded changes, the rollback reason and next step.

Do not weaken tests, change the workload, or optimize only for benchmark
inputs. Repeat noisy measurements before accepting small gains.

Keep the prompt current and save deferred ideas in .auto/ideas.md.
Continue until I interrupt you. Finish and log any active experiment before
addressing a follow-on message. Do not deploy or publish changes.
