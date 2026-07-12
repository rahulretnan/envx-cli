# 13 — Supporting Skills Catalog

When scaffolding (`14-scaffolding.md`), the skill offers to install relevant
supporting skills into the user's `.claude/skills/` folder. Skills are
copied from known source locations — either the user's existing project
skills folder or a remote git source (mirroring the `skills-lock.json`
pattern from tiaime).

## Discovery — find the user's existing skills

Before suggesting, scan these locations for `SKILL.md` files:

```
~/.claude/skills/                        # global
<existing-project>/.claude/skills/       # per-project
<existing-project>/.agents/skills/       # alternate location (wrytze pattern)
```

If found, propose copying from the local source first (faster, offline).
Otherwise, propose pulling from the known catalog below (git source).

## Universal — almost always install

| Skill | Source | Purpose |
|---|---|---|
| `web-design-guidelines` | local: askshelf/wrytze; vercel pkg | Review UI for accessibility + design |
| `vercel-react-best-practices` | local: askshelf/wrytze; vercel pkg | React performance patterns |
| `vercel-composition-patterns` | local: askshelf/wrytze; vercel pkg | Compound components, render props |

## Archetype A (Better-T-Stack) defaults

| Skill | Install if… | Purpose |
|---|---|---|
| `better-auth-best-practices` | Auth = Better Auth | Plugin combos, session shapes, multi-instance pattern |
| `neon-postgres` | DB = Neon | Pooling, branching, prepared statements |
| `next-best-practices` | Frontend = Next.js | File conventions, RSC, async APIs |
| `next-cache-components` | Frontend = Next 16+ | PPR, `use cache`, cacheLife, cacheTag |
| `turborepo` | Always (BTS uses Turbo) | Pipelines, caching, --filter |
| `hono` | Backend = Hono on Bun (askshelf variant) | Hono CLI, route patterns |

## Archetype B (Hasura + Amplify) defaults

| Skill | Install if… | Purpose |
|---|---|---|
| `hasura` | Always for B | Migration scaffolding, metadata YAML, ad-hoc GraphQL — generalized version of tiaime's skill |
| `turborepo` | Always | Same as above |

## Mobile modifier

| Skill | Install if… | Purpose |
|---|---|---|
| `mobile-release` | Modifier = Expo mobile + EAS | Apple-safe versioning, Changesets + EAS pipeline, branch model — generalized from tiaime |
| `agent-device` | Mobile + on-device agent | On-device agent toolkit |

## Project-management integrations

| Skill | Install if… | Purpose |
|---|---|---|
| `asana-formatting` | Team uses Asana | HTML-only formatting for task descriptions/comments |
| `linear-formatting` | Team uses Linear | Markdown formatting for Linear issues |
| `notion-formatting` | Team uses Notion | Block-based formatting for Notion pages |

## Module audit

| Skill | Install if… | Purpose |
|---|---|---|
| `module-audit` | Always (generalized from tiaime) | 5-phase audit: discovery → scenarios → bug hunt → tasks |

## Voice / AI extras

| Skill | Install if… | Purpose |
|---|---|---|
| `livekit-agents` | Voice via LiveKit | Agent worker patterns, session lifecycle |
| `mastra` | Agent framework = Mastra | Memory tiers, tool definition pattern |
| `elevenlabs-conv-ai` | Voice via ElevenLabs Conv AI | Custom LLM seam, tool sync |
| `ai-sdk-v6` | AI workloads (any) | Per-phase model selection, AI Gateway |
| `upstash-workflow` | Multi-step AI pipeline | Orchestration patterns |

## India market

| Skill | Install if… | Purpose |
|---|---|---|
| `aadhaar-qr-verify` | KYC needed | UIDAI cert validation, JPEG2000 decoder |
| `dodopayments` | India subscription billing | Webhook idempotency, dunning, trial logic |
| `whatsapp-cloud-api` | WhatsApp messaging | Template approval flow, template sync |

## Infra

| Skill | Install if… | Purpose |
|---|---|---|
| `sst-v3` | Archetype A | SST config patterns, λ provisioning, cron |
| `amplify-gen2` | Archetype B | backend.ts patterns, CDK escape hatches |
| `envx-cli` | India market or any project with GPG env files | Encryption workflow |

## Install pattern — `skills-lock.json`

Mirror tiaime's pattern. Generate this at project root:

```json
{
  "version": 1,
  "skills": {
    "<skill-name>": {
      "source": "<github-org>/<repo>",
      "sourceType": "github",
      "computedHash": "<sha256>"
    }
  }
}
```

Or for locally-sourced skills:

```json
{
  "version": 1,
  "skills": {
    "<skill-name>": {
      "source": "<absolute-path-to-source>",
      "sourceType": "local",
      "copiedAt": "<ISO timestamp>"
    }
  }
}
```

## Discovery dialog

During Phase 9 / scaffolding, ask:

> I see you already have these supporting skills in your projects:
>   • better-auth-best-practices (in askshelf, wrytze)
>   • neon-postgres (in askshelf, wrytze)
>   • turborepo, next-best-practices, next-cache-components, vercel-*
>   • hasura, asana-formatting, mobile-release, module-audit (in tiaime)
>
> For your project (Archetype A + India + Mobile), I'd auto-install:
>   ✓ better-auth-best-practices, neon-postgres, next-best-practices,
>     next-cache-components, turborepo
>   ✓ web-design-guidelines, vercel-react-best-practices, vercel-composition-patterns
>   ✓ mobile-release (since you have Expo)
>   ✓ asana-formatting (since your team uses Asana — confirm?)
>   ✓ module-audit (for ongoing audits)
>
> Anything to add or remove?

Then copy from the local source paths and create `skills-lock.json`.

## Adding new skills to the catalog later

If user adds a custom skill they want available in future scaffolds, they
can run:

```bash
# From within an existing project
cp -r .claude/skills/<my-skill> ~/.claude/skills/
# OR push to github and register
```

The skill should then learn it for future projects.
