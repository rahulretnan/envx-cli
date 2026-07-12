# 05 — Module Decomposition (the 20-step per-module loop)

This file owns Phase 5 (module inventory) and Phase 6 (per-module deep
dive). A module is **NOT done** until all 20 sub-steps below are filled or
explicitly marked `N/A — <reason>`, AND both the skill and the user agree
the module is ready to move on.

## Module-grouping (Phase 5)

When user lists features, propose grouping into modules. Pattern:

> Based on what you've listed (auth, dashboard, occupants, rooms, rent,
> payments, expenses, wardens, settings, billing, support), I'd group as:
>
> - **Identity** — auth, settings/profile, password change, MFA
> - **Tenants** — occupants, rooms, beds, KYC, history
> - **Money** — rent, payments, expenses, billing, dunning
> - **Team** — wardens, invitations, role management
> - **Operations** — dashboard, reports
> - **Platform** — settings (org-level), support, audit log, impersonation
>
> Modules commonly forgotten that I'd add for a project like yours:
> - **Notifications** — channel prefs, templates, history
> - **Audit log** — every privileged action
> - **API keys** (only if integrators)
> - **Webhooks (incoming/outgoing)** (only if needed)
> - **Integrations** (OAuth providers, if needed)
>
> Want any of these? Adjust the grouping?

After confirmation, you have the module list. Now Phase 6 begins.

## The 20-step per-module loop

For each module, walk these in order. One question at a time. Adaptive.
Recommend with reasoning. Push back on vague answers. Apply proactive
prompts from `07-proactive-prompts.md`.

### 1. Module purpose & ownership

> "What's this module for in one sentence? Who's the primary user — owner,
> warden, customer, admin?"

Capture: 1-line purpose, primary role, secondary roles, where it sits in
the IA.

### 2. Pages / screens

For each page:
- Path (`/occupants`, `/occupants/[id]`, `/occupants/new`)
- Layout shape (list / detail / form / wizard / dashboard / settings tabs)
- Primary role + secondary roles that see it
- Whether it has tabs, modals, slide-overs, drawers
- Mobile-vs-desktop layout difference

Push for completeness: "Any settings sub-pages? Empty-state landing pages
before first record exists? Print/export views?"

### 3. UI components per page

For each page, enumerate EVERY interactive element:
- Buttons (label, icon, variant, role-gated?)
- Inputs (text, select, date, file, search, switch, slider)
- Tables (columns, sort, filter, pagination, density, row actions)
- Tabs, accordions, modals, drawers, popovers, tooltips
- Menu items, kebab actions, header actions
- Cards, list items, chips, badges
- Charts (type, dimensions, drilldown)
- Empty-state illustrations + CTAs

**Push hard here** — user will forget half. Ask: "Walk through what a
first-time user sees when they land on this page — every button, every link."

### 4. Actions / interactions (NOT just CRUD)

Full inventory beyond CRUD:
- list, get, create, update, delete (standard)
- bulk import / export / archive / delete
- filter, sort, search
- duplicate, version, fork
- share, invite, transfer ownership
- archive vs restore vs hard-delete
- comment, mention, tag, react
- subscribe / unsubscribe / follow
- impersonate, view-as
- role-gated sub-actions (e.g. "approve" by manager only)

For each action: trigger UI, API procedure called, role gate, side-effects,
telemetry event name.

### 5. API procedures / endpoints

For each procedure:
- Name (e.g. `occupant.list`)
- Style (oRPC / Hasura query / REST / webhook / AppSync mutation)
- Auth tier (public / authenticated / org-scoped / role-gated)
- Input shape (Zod schema)
- Output shape
- Rate limit (if any)
- Idempotency (if mutation)
- Caching (if query)
- Error taxonomy (which errors can this return)
- Middleware chain (auth → tenancy → permission → captcha → rate-limit → handler)

### 6. DB schema / tables

For each table this module owns:
- Columns (name, type, nullable, default, comment)
- Primary key (single or composite)
- Foreign keys (with ON DELETE behavior)
- Indexes (with stated purpose — "filter by status", "join to hostel")
- Constraints (CHECK, UNIQUE, partial UNIQUE)
- Enums used
- Soft-delete column?
- Audit-trail column (`createdAt`, `updatedAt`, `createdBy`, `updatedBy`)?
- Multi-tenant column (`orgId`, `hostelId`)?

### 7. End-to-end wiring

For each significant action, produce a Mermaid sequence diagram:
- Participants: User, Page Component, API handler, Service, DB, Queue,
  External services
- File-level paths for each participant
- Validation steps highlighted
- Idempotency check highlighted
- Telemetry hooks highlighted

This is the **non-negotiable** wiring spec — Claude Code reads this to
implement the feature without guessing.

### 8. State machine (if entity has explicit states)

Examples: rent (pending → paid → overdue → late), blog (draft → research →
write → review → published), order (new → accepted → preparing → out-for-
delivery → delivered → cancelled), kyc (pending → submitted → verified →
rejected).

For each:
- List every state
- List every transition (with trigger action, guard, side-effect)
- Mermaid `stateDiagram-v2`
- Dead-end states + recovery paths

### 9. Events / async / webhooks

- Events emitted by this module (name, payload shape, consumers)
- Events this module subscribes to
- Queues consumed (handler, retry policy, DLQ, idempotency)
- Schedulers (cron expr or per-row Scheduler)
- Webhooks emitted (to whom, signature scheme, delivery log)
- Webhooks received (from whom, signature scheme, idempotency window)

### 10. Edge cases (walked through, not just listed)

Load `06-edge-case-guide.md` and walk every applicable category. For each
category, ask the user "what should happen here?" — never accept silence.

Categories: empty / boundary / permission / concurrency / network /
data-integrity / time / deletion / external-deps / state-transitions /
rate-limit / idempotency / retry / dedup / eventual-consistency /
queue-back-pressure / cold-starts / secrets-rotation / partial-failure /
audit-gap / impersonation-trace / multi-region / time-skew / DST.

For each, doc the policy + the UX response.

### 11. Empty / loading / error / offline states (per page)

For each page, four columns:
- Empty (illustration, CTA, copy)
- Loading (skeleton shape, count, animated?)
- Error (recoverable vs fatal, retry behaviour, error code shown?)
- Offline (cached read? queue write? read-only badge?)

### 12. Telemetry / observability events

For each action, define:
- Event name (snake_case dot-notation, e.g. `occupant.created`)
- Event props (typed)
- When fired (success only / both / failure only)
- Dashboard it feeds (PostHog cohort, internal funnel)
- Alert threshold (if any)

Plus log levels per operation, span attributes, error boundaries.

### 13. Accessibility (a11y)

- Keyboard navigation order per page
- Focus management on modal open/close, navigation
- ARIA labels for icon-only buttons
- Screen reader behaviour for dynamic content
- Colour contrast on status badges
- Focus visible styles
- Reduced motion respect

### 14. i18n / locale formatting

Only if multi-language:
- Strings requiring translation per page
- Date/time formatting (ISO storage, locale display)
- Number/currency formatting per locale
- RTL support needed?
- Plural rules
- Default fallback locale

If single-language, still capture currency + date format expectations.

### 15. Feature flags / kill switches / rollout

- Which actions are flag-gated
- Fallback behaviour when flag is OFF
- Per-org override capability
- Kill-switch path (admin emergency disable)
- Staged rollout plan (10% → 50% → 100%)
- A/B variant definition (if any)

### 16. Responsive design / breakpoints

- Mobile (< 640px) layout: which columns hide, which actions become a menu
- Tablet (640-1024) layout
- Desktop (> 1024) layout
- Print view (if applicable)
- Specific gestures on mobile (swipe to archive, long-press menu)

### 17. Copy / microcopy library

For each page:
- Page title + subtitle
- Section headers
- Button labels (action + cancel variants)
- Form labels + placeholders + helper text
- Validation error messages (field-level)
- Toast success / error messages
- Empty-state copy + CTA
- Loading copy ("Crunching numbers…")
- Confirmation dialog copy

**Push hard** — copy is always forgotten and always shows up in PR review.

### 18. URL state & navigation behaviour

- What persists in URL (filters, sort, search, page, selected tab, selected
  row)
- Browser back/forward semantics
- Deep links from other modules / emails / notifications
- Shareable permalink format
- Query param schema
- Modal-in-URL pattern (`?modal=invite`)

### 19. Performance budget

- Page-level latency target (TTFB / LCP / TTI)
- API procedure target (p95 in ms)
- Payload size budget (initial JS + per-route)
- Image budget
- DB query budget per render (max N queries, max ms)
- Cache TTLs

### 20. SEO / social share (only if module has public pages)

- Page title pattern
- Meta description
- OG image generation strategy
- Structured data (JSON-LD type)
- Canonical URL rules
- Sitemap inclusion

### + Compliance / PII / tests (cross-cuts, always)

- PII fields in this module's tables (link to `compliance.md`)
- Retention policy per field
- Deletion handler behaviour
- Test plan: critical paths to unit/integration/e2e test

---

## Mutual-agreement gate

At the end of the loop, produce the self-assessment block from
`00-orchestration.md` and ask:

> **Module `<name>` — self-assessment**: <fill in counts per step>
>
> I think this module is ready to lock. Anything to add or revise before
> we move to the next?

Only proceed when both parties agree.

## After all modules are locked

Run cross-module reconciliation:
- Same entity referenced in 2+ modules → make sure shape matches
- Same role referenced → ensure RBAC matrix is consistent
- Same event emitted by one module + consumed by another → wire the consumer
- Same external integration touched by 2+ modules → consolidate in
  `shared/integrations.md`
