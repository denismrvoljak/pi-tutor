# pi-tutor

### Personal coding tutor for pi

`pi-tutor` turns pi into a teaching-oriented coding assistant.

It adapts to how you like to learn, remembers what you're learning, resumes topics over time, and guides you with hint-first help instead of jumping straight to solutions.

## What this is

`pi-tutor` is a tutor extension for pi. It is meant for learning while coding — not just getting answers, but building understanding, practicing in small steps, and keeping momentum across sessions.

## What it does

- adapts to your learning style and preferences
- remembers what you're learning and resumes it later
- keeps separate topic folders for different learning tracks
- prefers hints, questions, and next steps before full solutions
- helps you reflect on progress, blockers, and what to do next
- supports learning through small projects, exercises, and repeated practice

## Quick start

```bash
pi install https://github.com/denismrvoljak/pi-tutor
```

Then open pi and enable tutor mode:

```text
/tutor on
```

## What it includes

- `/tutor on`
- `/tutor off`
- `/tutor status`
- conversational onboarding that creates `learner-profile.md`
- topic tracks under `tracks/<topic-folder>/`
- track-aware prompt templates:
  - `/start_tutoring`
  - `/hint`
  - `/reflect`
  - `/next_step`
- track-aware skills for implementation mentoring and topic learning
- guards that require tutor mode to be on before tutor workflows run

## State layout

All tutor data lives under:

```text
${PI_CODING_AGENT_DIR:-~/.pi/agent}/pi-tutor/
```

### Global learner state

- `learner-profile.md` — durable learner preferences, goals, topics, and tutoring style

### Per-topic track state

Each learning stream gets its own directory under `tracks/<topic-folder>/`:

```text
${PI_CODING_AGENT_DIR:-~/.pi/agent}/pi-tutor/
├── learner-profile.md
└── tracks/
    └── <topic-folder>/
        ├── track.md
        ├── roadmap.md
        └── progress.md
```

The folder name is just a short filesystem-safe topic name.

File roles:

- `track.md` — what the track is about, keywords, learner-specific notes
- `roadmap.md` — milestones and exercises
- `progress.md` — current focus, completed work, reflections, blockers, next step

This package is intentionally markdown-first. There is **no hidden active-track state** to keep in sync.

## Local development install

Run `pnpm install` once in the package repo before installing it into pi.

```bash
cd /absolute/path/to/pi-tutor
pnpm install
```

### Local path install

Use this when developing on the package itself:

```bash
pi install /absolute/path/to/pi-tutor
pi list
```

### Project-local install

Use this when you want a clean temporary environment or project-scoped setup:

```bash
cd /absolute/path/to/pi-tutor
pnpm install

export PI_CODING_AGENT_DIR="$(mktemp -d)"
tmp_proj="$(mktemp -d)"
cd "$tmp_proj"

pi install -l /absolute/path/to/pi-tutor
pi list
pi
```

## Local development workflow with `/reload`

After the first local install, keep editing files in `/absolute/path/to/pi-tutor` and use `/reload` inside pi instead of reinstalling every time.

Typical loop:

```bash
cd /absolute/path/to/pi-tutor
pnpm test

export PI_CODING_AGENT_DIR="$(mktemp -d)"
tmp_proj="$(mktemp -d)"
cd "$tmp_proj"

pi install -l /absolute/path/to/pi-tutor
pi
```

Inside pi:

```text
/tutor on
/reload
```

What `/reload` should pick up:

- extension changes
- prompt template changes
- skill changes
- README / packaging changes are still verified by tests and smoke checks outside pi

## Everyday usage examples

All tutor workflows below assume tutor mode is on.

### 1. First-time onboarding

```text
/tutor on
I want to learn SQL joins through small exercises. I'm intermediate and I prefer hints over full solutions.
```

Expected outcome:

- pi asks only for missing onboarding details if needed
- `learner-profile.md` is created
- future tutoring turns use that profile

### 2. Create a new track

```text
/tutor on
I want to keep learning Redis caching patterns
```

Expected outcome:

- if no matching track exists, pi creates `tracks/<topic-folder>/`
- the new track gets `track.md`, `roadmap.md`, and `progress.md`

### 3. Resume an existing track

```text
/tutor on
I want to keep learning SQL joins
```

Expected outcome:

- pi matches the saved track heuristically
- pi injects the matching `track.md`, `roadmap.md`, and `progress.md`
- tutoring resumes from the current focus or next step

### 4. Ask for the next hint

```text
/hint LEFT JOIN filtering
```

Expected outcome:

- pi gives the next hint level instead of jumping to the full solution
- if you report meaningful progress or a blocker, `progress.md` can be updated

### 5. Reflect on what happened

```text
/reflect I finished two exercises but still confuse WHERE vs ON
```

Expected outcome:

- pi records the reflection in `progress.md`
- blockers and completed items are adjusted if needed
- `Next step` is refreshed

### 6. Ask what to do next

```text
/next_step SQL joins
```

Expected outcome:

- pi resumes the named track
- pi reads the latest roadmap + progress context
- pi refreshes `progress.md` if needed and returns one concrete next step

## Development and verification commands

```bash
cd /absolute/path/to/pi-tutor
pnpm test
pnpm check
pnpm pack:smoke
```

Useful extra loop when you only want to test the extension file directly:

```bash
pi --no-session -e /absolute/path/to/pi-tutor/extensions/pi-tutor/index.ts
```

## Known limitations

- **Heuristic track matching.** Track selection is string-matching based, so overlapping topic names can still confuse it.
- **Name the topic clearly.** Because state is markdown-first and there is no hidden active-track state, resume works best when the learner names the topic clearly.
- **No active-track file.** The package does not keep hidden current-track state.
- **Single-agent package.** No subagents are required or bundled.

## Smoke-check expectations

For a clean-environment verification run, check that:

- `pi list` shows the installed package source containing `pi-tutor`
- the package works with a fresh `PI_CODING_AGENT_DIR`
- no existing learner/profile state is required
- `/start_tutoring`, `/hint`, `/reflect`, and `/next_step` are available after install
- those tutor workflow commands refuse to run until `/tutor on` is enabled

## License

MIT
