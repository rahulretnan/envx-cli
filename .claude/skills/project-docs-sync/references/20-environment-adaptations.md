# 20 — Environment Adaptations (Claude Code vs Cowork)

The Cowork project-docs-generator and the Claude Code project-docs-sync
share most behavior. This file lists the specific adaptations to make
Claude Code feel native (not a port).

## Interaction model

| Aspect | Cowork | Claude Code |
|---|---|---|
| Multiple-choice questions | `AskUserQuestion` tool with structured UI | Plain-text question + numbered options inline |
| Long-running design sessions | Native (hours-long is fine) | Acceptable but devs typically prefer shorter sessions — offer to checkpoint and resume |
| File previews | `present_files` tool with click-to-open cards | None — just write the file; mention path in reply |
| Skill loading | One skill at a time via `Skill` tool | Skills load automatically via file path / matcher |
| Conversation persistence | Per-session in app | Per-shell session; resumable via `--continue` or by restarting in same repo |

## Tool model differences

Cowork has:
- `AskUserQuestion` (no Claude Code equivalent — use plain-text format)
- `present_files` (no Claude Code equivalent — just write & mention path)
- `mcp__cowork__create_artifact` (no Claude Code equivalent — write HTML to file instead)
- `mcp__visualize__show_widget` (no Claude Code equivalent — write Mermaid into markdown)

Claude Code has:
- `Edit` / `MultiEdit` (Cowork has `Edit` but uses it less aggressively)
- `Bash` (Cowork has it but with constraints — Claude Code can run full dev cycle)
- `Grep` (both have it; Claude Code uses it more for code search)
- `WebSearch` / `WebFetch` (both have them)
- Subagent (`Task` or `Agent` tool) — Claude Code can spawn parallel subagents for big audits

## Plain-text question format

Replace every `AskUserQuestion` call with this template:

```
**<Question text>?**

Options:
1. **<Option A>** (Recommended) — <one-sentence reasoning>
2. <Option B> — <when to pick> · don't pick if <caveat>
3. <Option C> — <when to pick> · don't pick if <caveat>
4. Other — describe what you have in mind

Reply with the number, or describe your own.
```

If the question has only 2 options (yes/no or A/B):

```
**<Question>?**

- Yes/A — <implication>
- No/B — <implication>

Recommendation: <X> because <reason>.
```

For open-ended answers (no fixed options):

```
**<Question>?**

I need: <specific format / examples>.

For instance: "<example answer>"
```

## Greeting differences

### Cowork greeting (already in `00-orchestration.md`)
> Hey — let's spec this out properly so Claude Code can build it without
> guessing. I'll ask one question at a time...

### Claude Code greeting (adapt for the dev audience)
> Detected `docs/project/` for **<project-name>** · Archetype <X> · <N> modules · drift: <none / P0:n / P1:n / P2:n>.
>
> I'm running in Claude Code with full code edit + Bash. Same patterns as
> Cowork's project-docs-generator — one focused question at a time,
> recommendations with reasoning, push-back on vague answers, change-tracking
> on every edit. No handoff back to Cowork — I own the whole loop here.
>
> What are we doing today?

For greenfield repo (no docs):

> No `docs/project/` here yet. Let me run the full 12-phase design with you
> — same as Cowork, just in CLI. Then I'll scaffold the code and we'll
> implement together.
>
> Ready? First question: **what are we building?** One line is enough.

## Mermaid rendering

In Cowork, you can render diagrams via `show_widget`. In Claude Code, you
write Mermaid blocks into markdown — most editors (VS Code, GitHub, Cursor)
render them inline. Always specify:

```markdown
\```mermaid
sequenceDiagram
  participant U as User
  ...
\```
```

Do NOT use ASCII art for diagrams (it ages badly). Always Mermaid.

## File creation vs file presentation

In Cowork:
1. Write the file
2. Call `present_files` with the path
3. User sees a clickable card

In Claude Code:
1. Write the file
2. Mention the path in the reply: *"Written: `docs/project/modules/tenants/module.md`"*
3. User opens it in their editor

Don't try to use `present_files` — it doesn't exist in Claude Code.

## Subagent use

In Cowork, you spawn subagents sparingly (high cost in app context). In
Claude Code, subagents are cheap and parallelizable — use them aggressively
for big audits:

- Auditing all 12 modules of a mature project → spawn 12 parallel subagents,
  one per module
- Reading 100+ files for a drift report → spawn 4-8 read-focused subagents
- Verifying spec-vs-impl parity across many features → parallel subagents

When using subagents, brief them in self-contained prompts (they don't
share your context). Be explicit about which doc to read + what to look for
+ what report format to return.

## Filesystem & shell

Claude Code can run any shell command. Use this:

- `pnpm db:generate && pnpm db:migrate` after schema doc changes
- `pnpm dlx tsx scripts/validate-docs.ts` for verification
- `pnpm test --filter <pkg>` to verify tests still pass after edits
- `git status` / `git diff` to confirm what changed
- `git log --oneline -20` to understand recent history

Always show the command + the relevant output snippet in your reply.

## Session resumption

After a `--continue` or new session in the same repo:

1. Run pre-flight (`16-pre-flight.md`).
2. Read `docs/project/changes-log.md` head-50 lines to recover recent context.
3. Read `docs/project/_temp/pending-doc-updates.md` if it exists.
4. Read `docs/project/_temp/known-gaps.md` if it exists.
5. Pick up where you left off.

## Multi-repo / monorepo nuance

Cowork typically works on one folder. Claude Code may be in a monorepo:

- `docs/project/` lives at monorepo root, not per app
- `CLAUDE.md` lives at monorepo root
- `.claude/skills/project-docs-sync/` lives at monorepo root
- Per-app docs are inside `docs/project/modules/<m>/` not in `apps/<x>/docs/`

If user opens Claude Code inside `apps/<x>/`, the skill still walks up to
find `docs/project/`.

## Environment variables / secrets

In Cowork, secrets are abstracted. In Claude Code, you might encounter:
- `.env.development` (encrypted via envx-cli — needs `make env-dev`)
- `.env.production.gpg` (don't decrypt unless asked)
- AWS credentials via profile (use the project's documented profile, e.g. `Datahase`)

Don't proactively decrypt secrets. Don't print decrypted secrets to chat.
If user shares one accidentally, never store it.

## "Done" semantics

Cowork can declare "docs are complete" — that's the natural end. Claude
Code has a different "done":

- "Feature X done" → Validation gate (`19-validation-gate.md`)
- "PR ready" → All current edits change-tracked + validation passed
- "Sprint done" → All implemented features validated + drift = 0
- "Project done" → Never really (always evolving)

## Where Cowork still helps

Even though Claude Code is the full successor, Cowork retains value for:

- **Initial product design** where the user wants a more conversational,
  visual experience (multiple-choice UIs, file previews, side panels)
- **Non-developer stakeholders** who need to participate in design but
  don't want a terminal
- **Initial scoping** where the user prefers Cowork's pace and UI

After initial setup, **Claude Code owns everything**. No handoff back.
