---
Status: Draft | Filed | Retest-Failed | Closed
Asana Task: <gid | not filed>
Filed: YYYY-MM-DD
---

# [<Platform>][<S1|S2|S3|S4>] <Short what + where>

> One bug per ticket — split unrelated issues.
> Title example: `[Mobile/iOS][S1] Sign-in hangs after Google OAuth`

## 1. Summary
<One sentence: what's broken, where, and for whom.>

## 2. Bug Type
<UI — visual/layout/styling/copy | Functional — behaviour or logic wrong | Improvement — works as built but should be better>

## 3. Feature/Module
<module> — [feature spec](../modules/<m>/features/feature-<slug>.md)

## 4. Severity
<S1 Blocker — core flow impossible, crash, data loss, security
 S2 Major — important feature broken, no reasonable workaround
 S3 Minor — partially broken or has a workaround
 S4 Cosmetic — visual/copy only>

## 5. Priority
<High | Medium | Low> — business call; independent axis from severity.

## 6. Environment
- Platform: <Web (which app) | Mobile (iOS/Android) | API>
- Environment: <Local | Staging | Production>
- Exact URL or screen: <...>
- Build / version: <observed in> (latest: <if different>)
- Device / OS: <...>
- Browser + version: <web only>
- Observed at: <date, time, timezone>

## 7. Test Data
- Role used: <role>
- Test account(s): <accounts per role/plan>
- Relevant data state: <e.g. first-time user, empty list, enrolled in X>

## 8. Steps to Reproduce
1. <from a known clean start>
2. <...>
3. <...>

Reproducibility: <Always | Often (~n/10) | Rarely | Once>

## 9. Expected Result
<The single correct outcome — quote the spec.>

## 10. Actual Result
<What actually happened — paste the exact error text.>

## 11. Evidence
- <⭐ Jam.dev recording link | screen video + console/network screenshots | screenshots + console errors + failed request (method, URL, status, response)>

## 12. Regression Check
- Worked before? <Yes | No | Unknown>
- Last known good build or date: <...>
- <New feature | Regression>

## 13. Acceptance Criteria — "Done when"
- [ ] <testable condition>
- [ ] <adjacent behaviour that must keep working — other roles / plans / flows>

**Dev fills before handing back to QA: Fixed in build / version ___**

## 14. Workaround
<workaround or "none">

---

## QA pre-submit checklist
- [ ] One bug per ticket
- [ ] Type + Severity + Priority set
- [ ] Build/version + environment filled in
- [ ] Role + test account(s) provided
- [ ] Steps reproduce from a clean start
- [ ] Both Expected and Actual stated
- [ ] At least one piece of evidence attached
- [ ] Acceptance criteria defined
