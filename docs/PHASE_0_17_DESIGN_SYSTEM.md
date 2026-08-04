# 17 — Proposed Design System

## Preserve

The existing navy/red/yellow identity, semantic CSS variables, 0.75rem base radius, responsive dashboard shell, skip link, reduced motion, and button/input primitives are sound starting points (`app/globals.css`).

## Correct first

- Self-host a Bangla-optimized font (recommended evaluation: Noto Sans Bengali or Hind Siliguri) with required weights only. Current CSS names fonts but loads none.
- Use one display face that renders Bangla reliably; remove the unloaded Playfair-first stack.
- Replace raw color utility variations with semantic tokens.
- Remove gratuitous gradients/hover lifts/animated tutor icon in daily-work surfaces.

## Token contract

| Category | Tokens |
|---|---|
| Typography | 12/14/16/18/24/32 px; Bangla line-height 1.5–1.7; weight 400/600/700 |
| Spacing | 4, 8, 12, 16, 24, 32, 48 |
| Radius | 8 control, 12 card, 16 dialog; avoid arbitrary 24/32 everywhere |
| Surfaces | canvas, surface, raised, muted, inverse |
| Text | primary, secondary, muted, inverse, link |
| Status | info, success, warning, danger, neutral; each with icon/text, not color only |
| Focus | 2px high-contrast ring + 2px offset |
| Motion | 100/180/250 ms; respect reduced motion |
| Breakpoints | mobile <640, compact 640–1023, desktop ≥1024 |
| Layers | header 30, mobile nav 40, overlay 50, toast 60 |

## Component set and states

Foundation: Button, IconButton, LinkButton, Input, Textarea, Select, Combobox, Checkbox, Radio, Switch, Field, Date/Time input, FileUpload.

Structure: PageHeader, Section, Card, Metric, StatusBadge, EmptyState, ErrorState, Skeleton, Breadcrumb, Tabs, Stepper, Drawer, Dialog, AlertDialog, Toast, Tooltip.

Data: SearchField, FilterBar/Drawer, ResponsiveDataView, Table, mobile card list, pagination/cursor controls, bulk-action bar, export control.

Every component requires keyboard behavior, accessible name/description, visible focus, loading/disabled/error/empty state, 44×44 touch target where interactive, and a mobile behavior spec.

## Role-oriented layouts

- Student/mobile: one primary action, compact today list, bottom nav of four actions + more.
- Teacher/mobile: class session and attendance optimized for one-hand marking.
- Guardian/mobile: child switcher + exceptions/alerts, no student feature duplication.
- Admin/desktop: dense but readable data views, saved filters and permission-aware bulk actions.

## Verification

Story-level accessibility tests, axe in browser E2E, keyboard-only review, 320/390/768/1024/1440 widths, Bangla wrapping/line-height snapshots, forced-colors and reduced-motion checks.
