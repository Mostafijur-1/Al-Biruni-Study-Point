# Phase 2 — Academic core, slice 4

## Objective

Expose the guarded timetable core as a fast, mobile-first class-operations workspace without changing the Phase 2 rollout boundary.

## Changes completed

- Added a shared administrator/teacher timetable workspace with responsive cards instead of compressed desktop tables.
- Made `/teacher/classes` the primary routine and class-session workflow while preserving content management at `/teacher/classes?view=content`.
- Added `/admin/academic` as the sixth and final top-level administrator destination.
- Added accessible labelled controls, live loading/result regions, empty states, explicit confirmation for terminal actions, and touch-sized actions.
- Added organization, batch, subject, and teacher display context to the scoped teacher-assignment response so the UI never depends on raw identifiers.
- Added organization-timezone conversion for date/time inputs, including deterministic tests for Dhaka local time.
- Kept all mutation controls behind the existing server-side `ACADEMIC_WRITES_ENABLED` gate and displayed the rollout state in the workspace.

## Verification

- Navigation contracts enforce no more than six top-level destinations for teachers and administrators.
- Timezone conversion and existing academic rules are covered by the automated test suite.
- Type checking and linting validate component contracts, labelled controls, and React lifecycle behavior.
- Interactive browser validation was attempted, but no in-app or attached browser session was available. Authenticated mobile/desktop, keyboard, and screen-reader smoke checks remain an operational gate.

## Safety boundary

No bootstrap, migration, parity audit, integration cleanup, feature-flag change, or database mutation was run for this slice. Phase 3 attendance remains blocked until the operational gates in `docs/PHASE_2_COMPLETION_GATE.md` pass.
