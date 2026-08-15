# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.1.1] - 2026-08-15

### Added

- **Interactive status filtering** — Clicking ticket summary/metric cards in both the standard and Admin ticket list views now dynamically updates the status filter.
- **Awaiting Executive metric card** — A new card to track the count of tickets pending executive signoff in the Admin Tickets dashboard.

### Changed

- **Code cleanup & formatting** — Cleaned up JSX formatting and alignment of `onClick` handlers in ticket listing components.

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
