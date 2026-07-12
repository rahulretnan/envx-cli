---
Status: Draft | In Review | Approved | Implemented
Version: 1.0
Owner: <Name>
Last Updated: YYYY-MM-DD
---

# Design Guidelines

## Tokens

### Colours

| Token | Light | Dark | Use |
|---|---|---|---|
| `bg.canvas` | #ffffff | #0a0a0a | Page background |
| `bg.surface` | #fafafa | #141414 | Cards |
| `text.primary` | #0a0a0a | #fafafa | Body |
| `text.secondary` | #6b6b6b | #a4a4a4 | Helper |
| `accent.primary` | <brand> | <brand> | Primary CTAs |
| `status.success` | #16a34a | #22c55e | Success states |
| `status.warning` | #d97706 | #f59e0b | Warning states |
| `status.danger` | #dc2626 | #ef4444 | Error states |
| `border.subtle` | #e5e5e5 | #262626 | Hairlines |

### Spacing
4 / 8 / 12 / 16 / 24 / 32 / 48 / 64 / 96 px. Use Tailwind scale 1–24.

### Radius
- `sm`: 4 px (chips, badges)
- `md`: 8 px (buttons, inputs, cards)
- `lg`: 12 px (modals, popovers)
- `pill`: 9999 px

### Type scale
- Display: 36/40, weight 600
- H1: 28/32, weight 600
- H2: 22/28, weight 600
- H3: 18/24, weight 600
- Body: 14/20, weight 400
- Caption: 12/16, weight 400
- Mono: JetBrains Mono / Geist Mono

Font family: Geist (or per-project — define here).

### Motion
- Snap (UI feedback): 150 ms ease-out
- Smooth (transitions): 250 ms ease-in-out
- Slow (modal/sheet): 350 ms ease-in-out
- Respect `prefers-reduced-motion`

## Components

### Buttons

| Variant | Use | Tailwind |
|---|---|---|
| Primary | Main action per screen | `bg-accent text-white` |
| Secondary | Common actions | `border` |
| Ghost | Tertiary / inline | `hover:bg-bg-surface` |
| Destructive | Delete / cancel | `bg-status-danger text-white` |
| Icon-only | In tables, headers | Tooltip required, ARIA label required |

Sizes: sm (28px) / md (36px) / lg (44px). md is default.

### Form controls

- All form fields wrapped with `<Label>`, `<HelperText>`, `<ErrorMessage>`
- Required indicator: `*` after label (red)
- Disabled inputs: cursor-not-allowed + 50% opacity
- Required validation on blur for sync, on submit for async

### Empty states

Layout: centered illustration + heading + body copy + primary CTA.
Illustration: SVG, neutral colour, not branded character art.

### Loading states

- Use skeleton over spinner for content
- Use spinner for action-triggered loading (button → spinner)
- Use progress bar for known-duration operations (upload, export)

### Toasts (sonner)

- Success: 4s auto-dismiss
- Error: persistent, requires user dismiss or action
- Loading: persistent until promise resolves
- Position: bottom-right (desktop), bottom-center (mobile)

### Modals vs slide-overs vs drawers

- Modal: focused decision, blocks interaction with page (delete confirm, share)
- Slide-over: form / detail panel, page still visible (edit user, view ticket)
- Drawer: navigation, persistent (mobile menu)

### Tables

- Sticky header on scroll
- Row hover state
- Row click → navigate (icon at right indicates click target)
- Multi-select via checkbox column
- Bulk action bar appears on selection (top or bottom of table)
- Sort indicators on column headers
- Filter chips above table (resettable individually + "clear all")

## Patterns

### Multi-tenancy UI

- Org switcher in top-left (logo + name + chevron)
- "Acting as <org>" badge in admin impersonation
- Org name in page titles where ambiguous

### Bulk operations

- Selection mode toggled by checkboxes
- "Selected (N)" count in bulk action bar
- Confirmation modal for destructive bulk ops
- Progress indicator for long-running bulk

### Empty + first-run

- Empty state CTAs lead to a guided creation flow, not the same form

### Error UX

- Inline (next to field) for validation
- Toast for transient (network)
- Page-level error block for fatal
- Always include "what to do next" (retry / contact support / report)

### Dark mode

- All components must support both themes
- Use semantic tokens (not raw hex) in components
- Test contrast in both modes

## Accessibility baseline

- WCAG 2.2 AA
- Keyboard navigation works on every interactive element
- Focus visible (do not remove outline without a replacement)
- Screen reader announces:
  - Page title on navigation
  - Toast messages (`role="status"` for success, `role="alert"` for error)
  - Loading state (`aria-busy`)
  - Validation errors (`aria-invalid` + `aria-describedby`)
- Forms: every input labelled, every error associated
- Tables: `<caption>` or `aria-label`, `<th scope=...>`
- Images: alt text or `aria-hidden` if decorative
- Colour: not the only indicator (icon or text alongside)
- Reduced motion: respect `prefers-reduced-motion: reduce`

## Mobile / responsive

Breakpoints: 640 (sm) / 768 (md) / 1024 (lg) / 1280 (xl).

- < 640: single column, stacked navigation, bottom sheet for filters
- 640-1024: two-column where useful, sidenav as overlay
- > 1024: full sidenav, multi-column dashboards

Touch targets: minimum 44×44 px on mobile.

## Iconography

- Library: `lucide-react`
- Stroke width: 2 default, 1.5 for fine detail
- Avoid mixing icon libraries
- Icon-only buttons: always have tooltip + ARIA label

## Imagery / illustrations

- Use SVG only (scalable, themeable)
- Neutral, abstract — avoid branded character art for empty states
- Optimise to < 30 KB per illustration

## Microcopy voice

- Direct, plain. Avoid jargon.
- Sentence case (not Title Case) for buttons, headings
- "You" not "the user"
- Verbs in buttons ("Save changes" not "OK")
- Avoid "please" in errors; do say what went wrong + what to do

## Related
- **Tech stack:** [tech-stack.md](../tech-stack.md)
- **Per-module copy:** in each `modules/<m>/module.md`

## Changelog

| Version | Date | Changes |
|---------|------|---------|
| 1.0 | YYYY-MM-DD | Initial draft |
