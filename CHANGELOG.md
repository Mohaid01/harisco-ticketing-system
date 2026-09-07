# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.1.1] - 2026-08-15

### Added

- **Interactive status filtering** — Clicking ticket summary/metric cards in both the standard and Admin ticket list views now dynamically updates the status filter.
- **Awaiting Executive metric card & status badge** — A new card to track the count of tickets pending executive signoff in the Admin Tickets dashboard, and a matching status badge in the admin ticket table.

### Changed

- **Code cleanup & formatting** — Cleaned up JSX formatting and alignment of `onClick` handlers in ticket listing components.

### Fixed

- **Admin Ticket Status Filter** — Restored the `onChange` event handler on the status filter dropdown in the Admin Ticket list view.

## [Unreleased]

### Added

- **Attendance Device Status & RBAC Enforcement** — Added real-time attendance device connection status tracking and enforced strict role-based access control (RBAC) navigation locks.
- **Leave Details Attachment Preview & Fullscreen Lightbox** — Added medical certificate attachment preview, file download support, and fullscreen image lightbox view for leave applications.
- **New Ticket Types** — Added `email`, `installation`, and `others` options to `TicketType` with corresponding database schema migrations and form inputs.
- **Date Range Filters** — Integrated `From`/`To` date range filters in both standard `TicketList` and `AdminTicketList` components.
- **Admin Ticket State Reversion** — Managers can revert an admin ticket to its previous state; tickets with no recorded previous state revert to Open (`awaiting_admin_manager`). Revert is blocked for tickets already in their initial state.
- **Notice Author Editing** — Enabled notice authors to edit their own notices via a dedicated edit button.
- **Ticket List Filtering & Count** — Added assignee filtering for tickets and IT queue, along with matching ticket counters ("Showing X of Y tickets") across list screens.
- **Factory Shifts & Scalable Midnight Crossing** — Added three factory shifts (Standard 08:00–20:00, Standard 08:00–21:00, Night 20:00–08:00) with dynamic midnight-crossing detection (`weekdayEnd.h < weekdayStart.h`).
- **Employee Offboarding** — Soft-delete users with `is_active` flag, backdatable offboarding date picker, calendar status display, dimmed user cards, login blocking, and export filtering.
- **CI Checks Workflow** — Automated pre-merge validation pipeline for code formatting, linting, TypeScript compilation, and security vulnerability audit.
- **CODEOWNERS** — Mandatory review enforcement for `@Harisco-it` and `@Mohaid01` on pull requests.

### Changed

- **Status Label Standardization** — Standardized ticket status label casing to "In Progress" across status badges, filters, and modals.
- **Header Title Update** — Updated main navigation header text to "Dashboard".
- **Device Polling Interval** — Adjusted attendance device background polling interval to 3 minutes for optimized device sync.
- **Admin Ticket Schema** — Added `previousStatus` column to `admin_tickets` table and corresponding fields in data models and API response types.
- **Ticket Summary Statistics & Responsiveness** — Updated metric cards to count all tickets regardless of active filters, and enhanced responsive styling for mobile, tablet, and desktop views.
- **Select & Badge Styling Standardization** — Standardized select styling via `inputFieldStyle` to eliminate duplicated styles, and constrained role-badge container widths to `fit-content`.
- **Dependency Cleanup** — Removed unused `react-datepicker` dependency.
- **Ticket Action Label** — Simplified "Raise Issue Ticket" action button label to "Raise Ticket".
- **User Management Types** — Extended user models with `is_active`, `offboarded_at`, `offboarded_by`, and `offboard_reason`.

### Fixed

- **Site Duty Foreign Key Repair** — Added self-healing database migration to repair dangling foreign key references in `site_duty_applications`.
- **Site Duty & Leave Simulated Hours** — Fixed simulated check-out times and log calculations for "On Leave" and "Site Duty" records to match exact shift base duration (8 hours).
- **Employee Individual Attendance View** — Fixed daily calculation and status rendering for individual employee attendance screens.
- **Factory Midnight Rollover** — Yesterday shift override now correctly determines midnight-crossing for punches after midnight.

---

## [0.1.0] - 2026-08-07

### Added

- **Core ticketing system** — IT ticket lifecycle with approval workflows, comments, and activity logs
- **Admin ticket queue** — Separate admin-department tickets with executive escalation
- **Biometric attendance** — Real-time sync with PT-5000 devices via WebSocket
- **Factory attendance** — Isolated factory user attendance with separate punch processing
- **Factory user management** — CRUD for factory users with roles: Factory IT, Factory Manager, Factory Employee
- **Shift system** — Four shift types: Headquarters (09:30–18:00), Day (08:00–17:00), Night (20:00–05:00), Extended (09:00–20:00)
- **Shift overrides** — Per-user per-date shift changes via API
- **Leave management** — Casual, annual, and medical leave applications with approval hierarchy
- **Site duty management** — Field duty applications with department-head approval
- **Notice board** — Bilingual (English/Urdu) announcements with outage/maintenance/policy categories
- **SSE real-time updates** — Live attendance log broadcasting and admin ticket streaming
- **Excel export** — Attendance export with shift-aware hour calculations
- **Docker deployment** — Multi-stage build, docker-compose, Cloudflare Tunnel integration
- **Structured logging** — Security-focused audit trails for auth events and sensitive mutations

### Security

- JWT authentication with 7-day expiration
- Role-based access control (RBAC) with strict permission matrices
- Rate limiting: per-user write (100/15min), global read (2000/15min)
- bcrypt password hashing with salt rounds
- Parameterized SQL queries throughout
- Helmet.js CSP, HSTS, and security headers in production
- CORS origin restriction in production
- Security event logging for auth failures and sensitive mutations

---

## [0.0.1] - 2026-07-31

### Added

- Initial project scaffold with React 19, Express 5, SQLite
- Basic user authentication (JWT + bcrypt)
- HQ user management (IT, Manager, Executive, Employee roles)
- Basic attendance tracking with manual punch
- Ticket creation and assignment
- Leave and site duty application system
- ESLint + Prettier + Husky + lint-staged
- Docker multi-stage build setup
