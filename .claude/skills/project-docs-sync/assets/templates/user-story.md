---
Status: Draft | Pushed | Stale
Version: 1.0
Feature: <module>/<feature-slug>
Asana Task: <gid | not pushed>
Last Synced: YYYY-MM-DD
---

# User Story: <STORY title — short imperative>

> Generated from [feature-<slug>.md](../features/feature-<slug>.md) v<X.Y>.
> This file mirrors the Asana User Story Template. If the feature doc
> changes, regenerate this story (change-tracking flags it automatically).

## Story header

- **STORY:** <short imperative title, e.g. "Reset a forgotten password">
- **Surface(s):** <web app / mobile app / admin panel / public API / background job — note parity if multiple>
- **Actor / role:** <specific role(s)>
- **Who is allowed / not allowed:** <permission rule — who can perform, who is blocked>
- **Priority:** <P0 | P1 | P2> — **Type:** <new feature | enhancement | change | fix>
- **Depends on / related:** <upstream stories + related tasks>

---

## 1. User story

> As a <role>, I want to <action>, so that <benefit>.

## 2. Context / why

> <1-3 lines: why now, the problem it solves, link to spec.>

## 3. Scenarios (Gherkin)

**Scenario:** <happy-path name>
- **GIVEN** <preconditions — sign-in state, role, existing data, feature flag>
- **WHEN** <the trigger the user performs>
- **THEN** <what the system does / shows / returns>
- **AND** <further outcomes>

**Scenario:** <alternate/failure name>
- **GIVEN** <...>
- **WHEN** <...>
- **THEN** <...>

(Add as many scenarios as the workflow doc's alternative + failure paths require.)

## 4. Business rules & logic

- <non-negotiable rule, server-enforced>
- <calculation / threshold / ordering / validity rule>

## 5. Data & entities

- **Entities touched:** <main records involved>
- **CRUD:** <Create / Read / Update / Delete — which, on what>
- **New or changed fields:** <field — meaning, constraints, default>

## 6. Edge cases — WEESLD

- **Waiting** — <loading / in-progress UI: spinners, optimistic state, disabled buttons>
- **Empty** — <first-time / no-data state>
- **Error** — <every failure: validation, network, permission, server. Exact message + recovery action>
- **Success** — <confirmation: toast / redirect / updated UI, exact wording>
- **Limits** — <min/max, lengths, counts, rate limits, file size and type>
- **Default values** — <pre-filled values, fallbacks, default sort/filter>

## 7. UI / UX, copy & i18n

- **Designs:** <links or layout description>
- **User-facing copy:** <exact strings — labels, buttons, empty/error/success messages, email subject + body>
- **Accessibility / responsive notes:** <tap targets, keyboard flow, screen-reader labels, breakpoints>

## 8. Side effects

- **Emails:** <which / when, or "none">
- **Push / in-app notifications:** <when / to whom, or "none">
- **Background jobs / queue / cache:** <async work, cache invalidation, or "none">
- **Analytics events:** <events to fire, or "none">

## 9. Out of scope / non-goals

- <at least one item>

## 11. Technical context

- **Layers touched:** <data/storage / API or services / UI / background jobs>
- **Suspected entities / endpoints:** <list> — **Migration needed:** <yes / no>
- **Non-functional flags:** <performance, security, privacy/compliance, rate limits>

## 12. References

- **Spec / PRD:** [feature-<slug>.md](../features/feature-<slug>.md)
- **Designs:** <links>
- **Related tasks:** <links>
- **External docs:** <links>

---

## Acceptance criteria (become [AC] subtasks in Asana)

- [ ] [AC] Happy path — <main success behaviour, specific and verifiable>
- [ ] [AC] Error state — <exact message + recovery action>
- [ ] [AC] Empty / first-time state — <what shows>
- [ ] [AC] Limits — <min/max / file size / rate-limit behaviour>
- [ ] [AC] Permission boundary — <who is blocked, enforced server-side not just hidden in UI>
- [ ] [AC] i18n — all user-facing strings localized, none hardcoded *(only if multi-language)*
- [ ] [AC] <one per server-enforced business rule>

## Changelog

| Version | Date | Changes |
|---------|------|---------|
| 1.0 | YYYY-MM-DD | Generated from feature doc v<X.Y> |
