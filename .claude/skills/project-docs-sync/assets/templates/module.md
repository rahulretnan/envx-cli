---
Module: <name>
Routes: /<route-group>/*
Owners: <primary role>, <secondary roles>
Status: Draft | Approved | Implemented
Version: 1.0
Last Updated: YYYY-MM-DD
---

# Module: <Name>

## Purpose
<One paragraph: what this module is for, who uses it, where it sits in the
product. Include the primary user persona and the secondary roles.>

## Module component diagram

```mermaid
flowchart LR
  subgraph Pages
    P1[/<route1>]
    P2[/<route2>]
  end
  subgraph Components
    C1[<Component1>]
    C2[<Component2>]
  end
  subgraph API
    A1[<router.procedure>]
    A2[<router.procedure>]
  end
  subgraph DB
    T1[(<table1>)]
    T2[(<table2>)]
  end
  subgraph Events
    E1>event.name]
  end
  P1 --> C1 --> A1 --> T1
  P2 --> C2 --> A2 --> T2
  A1 --> E1
```

## Page navigation flow

```mermaid
flowchart LR
  Sidebar --> ListPage[/<route1>]
  Dashboard --> Detail[/<route2>]
  ListPage --> Detail
  ListPage --> Create[/<route3>]
  Detail --> Edit[/<route4>]
```

## Pages

| Path | Page | Primary Role | Sub-components | Entities Shown |
|------|------|--------------|----------------|----------------|
| `/<route1>` | List | <Role> | <Component1>, <Component2> | <Entity1> |
| `/<route1>/[id]` | Detail | <Role> | <Component3>, <Tabs> | <Entity1>, <Entity2> |
| `/<route1>/new` | Create | <Role> | <Component4> | <Entity1> |

## UI components per page

### `/<route1>` (List)

- **Header**: title, "+ New" button (role-gated), search box, filter chips, density toggle, export menu
- **Table**: columns [<col1>, <col2>, <col3>], sortable on [<cols>], row actions [<view, edit, archive>], bulk select, pagination
- **Empty state**: illustration + "No <entity> yet" copy + primary CTA
- **Filter panel**: filters [<status>, <date range>, <owner>], reset button

(Repeat per page.)

## Actions (full inventory)

| Action | Trigger | API procedure | Role gate | Side-effects | Telemetry event |
|--------|---------|---------------|-----------|--------------|-----------------|
| List | Page load | `<router>.list` | <roles> | Cache 60s | `<entity>.list.viewed` |
| Filter | Filter chip | `<router>.list` w/ filter | same | URL state | `<entity>.filter.applied` |
| Sort | Column header | `<router>.list` w/ sort | same | URL state | — |
| Search | Search box (debounced) | `<router>.search` | same | Debounced 300ms | `<entity>.search.executed` |
| Create | "+ New" | `<router>.create` | <role> | Emits `<entity>.created` | `<entity>.created` |
| Bulk import | Header menu | `<router>.bulk-import` | <role> | QStash job → report email | `<entity>.bulk_import.started` |
| Bulk archive | Selection + menu | `<router>.bulk-archive` | <role> | Per-row events | `<entity>.bulk_archive.completed` |
| Edit | Detail page | `<router>.update` | <role> | Audit log | `<entity>.updated` |
| Archive | Detail menu | `<router>.archive` | <role> | Soft delete | `<entity>.archived` |
| Restore | Archive list | `<router>.restore` | <role> | Unset archivedAt | `<entity>.restored` |
| Export | Header menu | `<router>.export` | <role> | Async job → email link | `<entity>.export.requested` |
| Impersonate | Admin app | `admin.impersonate` | Platform Admin | Signed JWT, audit | `admin.impersonate.started` |

## Role × Action matrix

|  | Platform Admin | Owner | <Role3> | <Role4> | <Role5> |
|---|---|---|---|---|---|
| List | ✓ | ✓ | ✓ | ✓ | ✓ |
| Create | ✓ | ✓ | — | ✓ | — |
| Edit | ✓ | ✓ | — | ✓ | — |
| Archive | ✓ | ✓ | — | — | — |
| Bulk import | ✓ | ✓ | — | — | — |
| Export | ✓ | ✓ | — | — | — |
| Impersonate | ✓ | — | — | — | — |

Legend: ✓ full · own = only own records · — blocked

## Empty / loading / error / offline states

| Page | Empty | Loading | Error | Offline |
|------|-------|---------|-------|---------|
| List | Empty illustration + "Add your first <entity>" CTA | Skeleton rows (5) | Retry button + error code | Cached list (read-only badge) |
| Detail | "<Entity> not found" + back link | Skeleton blocks | Retry + back | Cached version |
| Create | Form ready | — | Per-field validation + toast on server error | Queue draft locally, sync when online |

## Accessibility

- Keyboard navigation: tab order = [search → filter chips → table → row actions]
- Focus management: modal open → focus first input; close → restore to trigger
- ARIA: icon-only buttons labelled; live region for filter result count; row checkboxes labelled with row title
- Screen reader: announces sort changes, filter changes, "loading", "error"
- Color contrast: status badges meet WCAG AA in both themes
- Respects `prefers-reduced-motion`

## i18n keys (if multi-language)

| Key | English fallback | Used in |
|---|---|---|
| `<module>.page.list.title` | "<Entities>" | List page header |
| `<module>.action.create` | "+ New <entity>" | Header button |
| `<module>.empty.message` | "No <entities> yet" | List empty state |
| `<module>.empty.cta` | "Add your first <entity>" | List empty state CTA |
| ... | ... | ... |

## Feature flags / rollout

| Flag | Default | Gates | Off behaviour |
|---|---|---|---|
| `bulk-import` | true | Bulk-import action | Action hidden from menu |
| `<entity>-export-pdf` | false (rolling) | PDF export option | Only CSV visible |

## Responsive design

- **Mobile (< 640)**: table collapses to card list; filter panel becomes bottom sheet; bulk actions move to "Select" mode
- **Tablet (640-1024)**: shows 4 columns; rest behind kebab
- **Desktop (> 1024)**: full table

## Copy library

| Element | Copy |
|---|---|
| Page title | "<Entities>" |
| Empty state copy | "No <entity> yet. Add your first to get started." |
| Empty state CTA | "+ Add <entity>" |
| Confirm archive title | "Archive <entity>?" |
| Confirm archive body | "<entity> will be hidden from lists. You can restore from Archive any time." |
| Toast success create | "<entity> added" |
| Toast error generic | "Couldn't save changes. Try again." |
| ... | ... |

## URL state

| Param | Persists in URL | Browser back |
|---|---|---|
| `?q=<text>` | search term | back clears search |
| `?status=<status>` | filter | back clears filter |
| `?sort=<col>&dir=<asc|desc>` | sort | back clears sort |
| `?page=<n>` | pagination | back returns to prev page |
| `?modal=invite` | invite modal | back closes modal |

## Performance budget

- List page TTFB target: **200 ms** p95
- LCP: **1.5 s**
- API `list` p95: **150 ms** (cache hit) / **400 ms** (miss)
- Initial JS payload: **180 KB** gzipped
- Max DB queries per render: **3**

## SEO / social share

(Only if module has public pages. Otherwise mark N/A.)

| Field | Value |
|---|---|
| Page title pattern | "<Entity name> · <Brand>" |
| Meta description | Auto-generated from entity description |
| OG image | Dynamic via `/api/og/<entity>/[id]` |
| Structured data | `Product` / `Article` / ... |

## Cross-module dependencies

- **Reads from**: <Module>.<Entity>, <Module>.<Entity>
- **Writes to**: <Module>.<Entity>
- **Emits events consumed by**: <Module> (welcome email), <Module> (billing trigger)
- **Consumes events from**: <Module>

## Telemetry summary
See [observability.md](./observability.md)

## Compliance / PII summary
See [compliance.md](./compliance.md)

## Test plan summary
See [test-plan.md](./test-plan.md)

## Open questions

- [ ] <unresolved decision>

## Changelog

| Version | Date | Changes |
|---------|------|---------|
| 1.0 | YYYY-MM-DD | Initial draft |
