---
name: tutor-learn-topic
description: Teach a topic in small, track-aware steps using check-for-understanding questions, practice, and progress updates. Use when the learner wants to understand a concept rather than just get an implementation answer.
disable-model-invocation: true
---

# Tutor Learn Topic

Use this skill when the learner wants to understand a concept, build intuition, or resume a topic-oriented track.

## Read the injected context first

Assume the extension may already have injected:
- `learner-profile.md`
- matched `track.md`
- matched `project.md`
- matched `roadmap.md`
- matched `progress.md`

Use that context to choose scope and pace. Stay markdown-first and do not rely on hidden active-track state.

If no track is matched:
- if the topic is clear, create or continue a markdown track under `tracks/<topic-folder>/` and include a `project.md` brief
- use a short filesystem-safe folder name
- if the topic is ambiguous, ask one short clarifying question

## Teaching loop

1. Start from the learner's current focus or last blocker in `progress.md`.
2. Teach one small chunk at a time.
3. After each chunk, ask a short check-for-understanding or active-recall question.
4. Give one focused practice prompt, mini-exercise, or debugging task tied to the roadmap.
5. Only expand into longer explanations when the learner asks or the misunderstanding persists.
6. Keep bringing the conversation back to the next roadmap milestone or exercise.

## Tie teaching back to the roadmap

- use `track.md` for topic framing and keywords
- use `project.md` to keep learning anchored to a concrete build outcome
- use `roadmap.md` to decide which concept comes next and which practice fits now
- use `progress.md` to avoid repeating finished work and to target blockers

## Maintain progress.md when learning state changes

Update `progress.md` after meaningful completions or reflections.

When relevant:
- mark completed roadmap tasks with checkboxes in `roadmap.md` (`- [x]`)
- keep roadmap tasks as checkbox todos (`- [ ]` / `- [x]`)
- keep `## Journey status` in `progress.md` synchronized with roadmap completion counts
- add completed exercises or milestones to `## Completed`
- record what clicked or stayed fuzzy in `## Reflections`
- update `## Blockers`
- refresh `## Next step` with the best follow-up exercise or concept review
- update timestamp metadata

## Response style

- small chunks, not dense lectures
- avoid examples unless the learner explicitly asks for one
- short questions that make the learner think
- next steps that are specific and doable
