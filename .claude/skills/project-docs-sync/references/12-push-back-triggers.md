# 12 — Push-Back Triggers

When the skill detects a vague or under-specified answer, it MUST NOT
advance. It pushes back with a targeted follow-up. The point isn't to be
annoying — it's to prevent ambiguous docs that Claude Code can't act on.

## Format

`<vague-answer pattern>` → `<required follow-up>`

## Catalogue

### Tenancy / multi-tenant

| Vague | Push back |
|---|---|
| "Multi-tenant" | "By what axis — org / team / workspace / per-user / hybrid? And what crosses boundaries (billing, audit, support)?" |
| "Tenants" | "Plural tenants per what? Per org? Per signup? Per workspace inside an org?" |
| "Companies / accounts" | "One company = one billing entity, or can a company have sub-accounts each billing separately?" |

### Auth

| Vague | Push back |
|---|---|
| "Has auth" | "Provider? Methods (OAuth/email/magic/passkey)? Session lifetime? Refresh strategy? Admin separation? Impersonation? MFA? Password reset path?" |
| "Standard auth" | "Standard means different things — email+password? Google OAuth only? Same as your existing project X? Let's be explicit." |
| "Login with Google" | "Google only, or also email/password? Apple too (required for App Store if you have iOS)? Microsoft? GitHub for dev tools?" |
| "Logout" | "What invalidates: this session only, all sessions, or this device? Server-side revocation? Token blacklist?" |

### CRUD

| Vague | Push back |
|---|---|
| "Standard CRUD" | "Bulk ops? Imports/exports? Soft vs hard delete? Version history? Audit trail? Concurrent edit policy? Restore? Duplicate?" |
| "Manage X" | "Manage means create, read, update, delete, list, filter, sort, search, export, import? All of those? Plus role-gated sub-actions?" |
| "Approve / reject" | "Single approver or pool? Escalation? Timeout? Audit? Who can re-open after rejection?" |

### Realtime / events

| Vague | Push back |
|---|---|
| "Real-time" | "Subscriptions / WebSocket / SSE / polling? Who sees what (private vs public)? Presence indicators? Conflict resolution? Reconnect strategy? Message ordering guarantee?" |
| "Live updates" | "Server-pushed or client-polled? Latency tolerance (1s, 5s, 60s)? What event triggers an update? Who's subscribed?" |
| "Notifications" | "Channels (email/push/SMS/in-app/WhatsApp)? User prefs per channel? Quiet hours by timezone? Throttling (max N/day)? Templates per language? Per-user opt-out? Per-event-type toggles?" |

### Payments

| Vague | Push back |
|---|---|
| "Payment" | "Gateway? Subscription vs one-time vs usage-based? Currency? Tax / GST? Refund policy? Dunning (failed retry cadence)? Grace period? Trial?" |
| "Subscriptions" | "Tiered? Per-seat? Monthly + annual? Trial length? Proration? Downgrade-with-over-limit behaviour?" |
| "Free trial" | "How long? Credit card required upfront? What happens at end — auto-charge, downgrade to free, lock account?" |

### Search

| Vague | Push back |
|---|---|
| "Search" | "Postgres FTS / Elastic / Typesense / Algolia / Meilisearch / pgvector? Index update strategy (sync/async)? Multi-tenant filter? Typo tolerance? Synonym dictionary?" |
| "Filter" | "Single-select / multi-select per facet? Persistent in URL? Combination logic (AND/OR per facet)? Filter chips?" |

### Reports / analytics

| Vague | Push back |
|---|---|
| "Reports" | "Pre-aggregated dashboards / ad-hoc query / scheduled email exports? Format (CSV/PDF/XLSX)? Async generation? Retention? Max-row limit?" |
| "Dashboard" | "Default time range? Timezone? Drill-down? Export? Comparison period? Refresh cadence?" |
| "Analytics" | "Product analytics (PostHog/Mixpanel/Amplitude)? Or BI (Metabase/Looker)? What questions does the dashboard answer?" |

### Admin / impersonation

| Vague | Push back |
|---|---|
| "Admin panel" | "Same DB or shadow? Impersonation? Audit of admin actions? Role separation from regular admins? IP allowlist? MFA enforced?" |
| "View as user" | "Read-only or also actions? Time-bound (1h max)? Audit trail with acting-user vs impersonated-user? User notified?" |
| "Super-admin" | "Specifically what — full DB read? DB write? Customer impersonation? Billing override? Code deploy? Each is different." |

### Mobile

| Vague | Push back |
|---|---|
| "Mobile app" | "Native (Swift/Kotlin) / Expo / PWA / React Native bare? Online-only / offline-first / hybrid? Push provider? Update strategy (OTA / store)? Biometric unlock?" |
| "Works offline" | "Read-only offline (cached) or write-too (queue)? Conflict resolution when back online? What's the max offline duration tolerated?" |
| "Push notifications" | "FCM + APNs direct or Expo Push? Topic-based or token-based? Per-user opt-out? Quiet hours? Token cleanup on uninstall?" |

### Internationalization

| Vague | Push back |
|---|---|
| "Multi-language" | "Which languages on launch? UI only or also data? Search across languages? RTL? Date/number/currency formatting? Plural rules?" |
| "Globally available" | "First 3 markets? Latency SLA per region? Data residency? Will payment gateways differ?" |

### Compliance

| Vague | Push back |
|---|---|
| "GDPR compliant" | "Right-to-be-forgotten path? Data export path? Cookie consent? DPA with sub-processors? PII inventory? Regional data storage?" |
| "Secure" | "Encryption at rest for which fields? At transit (TLS — duh)? PCI DSS scope? HIPAA? SOC 2 ambitions? Key management?" |
| "Compliant" | "Which regulation specifically? DPDP / GDPR / CCPA / HIPAA / PCI / GLBA?" |

### Scale

| Vague | Push back |
|---|---|
| "Millions of users" | "Realistic for month 6? Hundreds, thousands, tens-of-thousands, hundreds-of-thousands of MAU?" |
| "High traffic" | "Requests/s peak? Read/write ratio? Largest endpoint by traffic?" |
| "Scales" | "Vertically or horizontally? Stateless? Bottleneck likely to be DB / API / queue / external service?" |
| "Performant" | "p50 / p95 / p99 in ms for the slowest endpoint? Page TTFB target? LCP target?" |

### Vague timeline

| Vague | Push back |
|---|---|
| "MVP" | "Define scope cut: which 3-5 modules are MVP? What's deferred? Is multi-tenancy MVP or post-MVP?" |
| "We'll add it later" | "Later means weeks or quarters? Let's capture as an open question with a defer-until trigger so it's not forgotten." |
| "Quick prototype" | "Throwaway after demo, or production-bound? Decision changes the stack significantly." |

### AI / voice

| Vague | Push back |
|---|---|
| "AI feature" | "LLM call / multi-step pipeline / agent with tools / RAG over private data / voice / vision? Which provider / model class?" |
| "Smart" | "Smart how — recommendations? Auto-categorization? Natural-language search? Be specific." |
| "Chatbot" | "Single-turn Q&A or multi-turn conversational? Tools (DB queries / actions)? Memory across conversations? Voice or text only?" |

### Generic

| Vague | Push back |
|---|---|
| "Configurable" | "By whom — end-user / admin / dev? Per-user / per-org / global? UI for it or env-var?" |
| "Modular" | "Modular at code level (packages) or product level (toggleable features per customer)? They're different problems." |
| "Flexible" | "Flexible for which dimension — schema, workflow, pricing, UI? Saying it for everything = building nothing well." |
| "Extensible" | "Customer-extensible (plugins/webhooks)? Internal-extensible (new modules)? Both?" |
| "Best practices" | "Whose best practice — Vercel's? AWS Well-Architected? OWASP Top 10? Let's name them explicitly." |
| "Industry standard" | "Cite the standard — that's how others can verify. ISO 27001? PCI DSS? OAuth 2.1?" |

## Anti-pattern: don't push back on every answer

The point is push back on **vague-to-the-point-of-actionability**. If user
says "Better Auth with Google OAuth, 7-day session, sliding refresh, admin
on subdomain, no MFA, no impersonation", that's complete — accept and move on.

The skill is here to make the user better at speccing, not to interrogate.
