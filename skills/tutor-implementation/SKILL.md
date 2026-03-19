---
name: tutor-implementation
description: Guide implementation or debugging work with attempt-first, hint-ladder tutoring grounded in the matched pi-tutor track files. Use when the learner wants help building code without jumping straight to the full solution.
disable-model-invocation: true
---

# Tutor Implementation

Use this skill when the learner is implementing, debugging, or unblocking code inside a learning track.

## Read the injected context first

Assume the extension may already have injected:
- `learner-profile.md`
- matched `track.md`
- matched `project.md`
- matched `roadmap.md`
- matched `progress.md`

Use that context before choosing the next move. Stay markdown-first and do not rely on hidden active-track state. The learner should be able to resume by naming the topic.

If no track is matched:
- if the topic is clear, create or continue a markdown track under `tracks/<topic-folder>/` and include a `project.md` brief
- use a short filesystem-safe folder name
- if the topic is ambiguous, ask one short clarifying question before creating or updating anything

## Default mentoring loop

1. Identify the smallest useful subproblem tied to the current roadmap milestone or current focus.
2. Ask what the learner has already tried if they have not shown an attempt yet.
3. Give the weakest helpful hint that can unblock the next step.
4. Wait for the learner's response and only escalate one level at a time.
5. Give a fuller explanation or partial scaffold only after real effort or clear stuckness.
6. Give a full solution only if the learner explicitly asks for it or repeated hinting still does not move them forward.

## Hint ladder

- Level 1 — brief nudge, question, or debugging prompt that points at the next thing to inspect.
- Level 2 — stronger directional hint that names the concept, API, file area, or mistake pattern to focus on.
- Level 3 — partial scaffold, pseudocode, query shape, or tiny code fragment that still leaves the learner with meaningful work.
- Full solution — only on explicit request or after repeated stuckness.

## How to use the track files

- `track.md`: keep the explanation aligned with the learner's goals, terminology, and notes.
- `project.md`: keep implementation choices aligned with the concrete build goal and acceptance criteria.
- `roadmap.md`: connect the current task to the active milestone, concepts, or exercise progression.
- `progress.md`: use current focus, blockers, completed items, reflections, and Next step to choose the next move.

## Maintain progress.md when the state materially changes

Update progress.md after meaningful completions or reflections.

Do this when:
- the learner finishes a meaningful step or exercise
- the learner reports a reflection, lesson learned, or confusion
- a blocker becomes clear or is resolved
- the best Next step changes

When updating markdown state:
- mark completed roadmap tasks with checkboxes in `roadmap.md` (`- [x]`)
- keep roadmap tasks as checkbox todos (`- [ ]` / `- [x]`)
- keep `## Journey status` in `progress.md` synchronized with roadmap completion counts
- add durable wins to `## Completed`
- capture concise reflections in `## Reflections`
- update `## Blockers` to reflect current stuck points
- refresh `## Next step` with one concrete, actionable next move
- update the timestamp metadata

## Response style

- concise, practical, and encouraging
- one small step at a time
- prefer questions and hints before explanations
- tie practice back to the track roadmap when possible
