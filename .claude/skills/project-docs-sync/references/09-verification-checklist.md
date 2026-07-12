# 09 — Verification Checklist (Phase 10)

After generation, walk this checklist. Produce a gap report. Present to
the user. They decide which gaps to fix (Phase 11).

## A. Structural completeness

- [ ] `docs/project/` exists at project root
- [ ] `tech-stack.md` present + filled
- [ ] `architecture-overview.md` present with all 9 project-wide diagrams
- [ ] `design-guidelines.md` present
- [ ] `glossary.md` present
- [ ] `decisions.md` present + lists every ADR
- [ ] `changelog.md` present (even if empty)
- [ ] `changes-log.md` present (header only OK)
- [ ] `_templates/` present + complete
- [ ] `CLAUDE.md` at project root
- [ ] `README.md` at project root
- [ ] `skills-lock.json` at project root (if Phase 12 ran)

## B. Per-module completeness

For each module in `index/modules.md`:

- [ ] `modules/<module>/module.md` exists
- [ ] Module file has page inventory table
- [ ] Module file has action × role matrix
- [ ] Module file has at least 1 Mermaid diagram (component or navigation)
- [ ] `features/` folder has at least 1 file
- [ ] Each feature has wiring section (sequence diagram + file paths)
- [ ] `api/` folder has at least 1 file matching chosen archetype
- [ ] `schema/` folder has at least 1 file
- [ ] `workflows/` folder has at least 1 file with swimlane
- [ ] `observability.md` present with at least telemetry event list
- [ ] `test-plan.md` present with at least critical-path list
- [ ] If module has stateful entities → `state-machines/` populated
- [ ] If module has scheduled/queued work → `async-jobs/` populated
- [ ] If module touches PII → `compliance.md` present

## C. Edge case coverage

For each feature:

- [ ] All 24 edge-case categories in `06-edge-case-guide.md` either
      addressed or marked `N/A — <reason>`
- [ ] No silent omissions

## D. Cross-references

- [ ] Every `[link](path)` resolves to an existing file
- [ ] Every feature mentioned in `module.md` has a `features/feature-*.md` file
- [ ] Every API procedure mentioned in `module.md` has an entry in `api/api-*.md`
- [ ] Every table mentioned in `module.md` has an entry in `schema/schema-*.md`
- [ ] Every workflow mentioned in `module.md` has a `workflows/workflow-*.md` file
- [ ] `index/features.md`, `index/apis.md`, `index/schemas.md`,
      `index/workflows.md` list every doc

## E. Code sample consistency

- [ ] Code samples match chosen archetype (oRPC vs Hasura vs REST — no mixing)
- [ ] Drizzle samples use latest version per workspace catalog
- [ ] All TypeScript samples compile against the declared package versions
- [ ] Mermaid diagrams use consistent node naming

## F. Stack-specific anti-patterns

Run anti-pattern scan from `08-anti-patterns.md`:

- [ ] No claim of tests without test files
- [ ] No "remove after <past-date>" markers
- [ ] No `db:push` recommendations
- [ ] No raw password / API key storage suggestion
- [ ] No single Vercel project for multi-app deploy
- [ ] No custom Upstash REST client suggestion
- [ ] No env var > 1 KB without SST Secret
- [ ] No Sentry-only-on-backend pattern
- [ ] No permissions table duplication
- [ ] No Drizzle in Hasura+Amplify project
- [ ] No NativeWind in post-Q1-2026 Expo project
- [ ] No Cognito in greenfield BTS project
- [ ] No Expo Push for >10k DAU plan
- [ ] No webhook handler without signature verification
- [ ] No queue without DLQ
- [ ] No JWT in localStorage suggestion

## G. India-market completeness (if India tagged)

- [ ] Dodopayments mentioned (not just Stripe)
- [ ] WhatsApp Cloud API mentioned for messaging
- [ ] ap-south-1 region in infra config
- [ ] envx-cli mentioned in env management
- [ ] GST invoice numbering rule captured
- [ ] DPDP Act compliance section in compliance.md
- [ ] Aadhaar encryption pattern (if KYC)

## H. Mobile-specific completeness (if Expo tagged)

- [ ] Uniwind or NativeWind explicit choice captured
- [ ] EAS Build profiles defined
- [ ] FCM + APNs key references captured
- [ ] Changesets mobile-release pattern documented
- [ ] Apple-safe versioning rule documented

## I. AI/Voice completeness (if AI tagged)

- [ ] AI SDK v6 + AI Gateway captured
- [ ] Per-call cost guard / credit metering
- [ ] Prompt-injection sanitisation
- [ ] Model fallback chain
- [ ] If voice: LiveKit + transport choice, agent worker isolation
- [ ] PII masking in transcripts

## J. Diagram coverage

- [ ] Architecture-overview has all 9 project-wide diagrams
- [ ] Every module has at least component diagram + navigation diagram
- [ ] Every workflow has swimlane
- [ ] Every stateful entity has state-machine diagram
- [ ] Every async-job has execution-flow diagram

## K. Diff against existing code (if codebase exists)

- [ ] CLAUDE.md claims match actual `package.json` deps
- [ ] Routing style claim matches actual router files
- [ ] Test claims match actual test files
- [ ] Auth claim matches actual auth config

## Gap report format

```markdown
# Verification Report — <date>

Total checks: <n>
Passed: <n>
Failed: <n>
N/A: <n>

## Failures (Priority order)

### P0 — Blockers (skill should refuse to declare done)
- [ ] <description> · affected docs: `<paths>` · fix-effort: <minutes>

### P1 — Should fix
- [ ] <description>

### P2 — Nice to fix
- [ ] <description>
```

## Resolution flow

After producing the gap report, ask the user:

> Verification report ready. <n> P0 blockers, <n> P1, <n> P2.
> Want to:
> 1. Fix all P0 now (Recommended)
> 2. Fix P0 + P1 now
> 3. Fix everything
> 4. Mark as deferred and proceed
>
> Pick one — and for P0s, I'll route back to the module deep-dive for each
> affected module.
