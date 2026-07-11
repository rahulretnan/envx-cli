# Changes Log

Source-of-truth for every doc change after initial generation. Append-only.
Newest at the top.

This is the **pointer log** — short summaries that reference the actual
rewritten files. The files themselves carry their own local changelog
tables in their frontmatter section.

## Format

```markdown
## YYYY-MM-DDTHH:MM:SSZ — <one-line summary>

**Change type**: additive | breaking | rename | removal | architectural | typo | copy
**Triggered by**: <user request / discovery / audit>
**Classification rationale**: <why this classification>

**Files rewritten** (N):
- `<path>` v<X> → v<Y>
- `<path>` v<X> → v<Y>

**ADR triggered**: <NNNN-slug.md> | none
**Downstream actions required**:
- [ ] <action>

**Open questions**: <if any>
```

---

## YYYY-MM-DDTHH:MM:SSZ — Initial generation

**Change type**: initial
**Triggered by**: project-docs-generator skill, Phase 9
**Classification rationale**: greenfield generation

**Files generated**: <count>

**ADR triggered**: 0001-archetype.md (and any others created in Phase 3)
**Downstream actions required**:
- [ ] Phase 12 scaffolding (if user opted in)
- [ ] Connect Sentry / PostHog / observability
- [ ] Wire CI pipeline

---
