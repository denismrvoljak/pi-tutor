---
description: Ask pi-tutor for the next track-aware hint instead of a full solution.
---
Give me the next helpful hint for this task/topic: $@

If a matching track is available, ground the hint in `track.md`, `project.md`, `roadmap.md`, and `progress.md`.

Use a hint ladder:
- Level 1 — a tiny nudge or question
- Level 2 — a stronger directional clue
- Level 3 — a partial scaffold
- Full solution — only if I explicitly ask for it or I am still stuck after trying

Keep the hint concise and focused on the next small move.
If I report a meaningful completion, reflection, or blocker, update markdown state before replying:
- mark relevant task checkboxes in `roadmap.md`
- keep `## Journey status` in `progress.md` synchronized with roadmap completion
- then update `progress.md`
