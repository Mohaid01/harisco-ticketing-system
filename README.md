# Harisco Ticketing System

A unified internal operations portal for ticketing, task tracker, biometric attendance, leave management, and site-duty workflows. Built with TypeScript, React, Express, and SQLite.

---

## 📋 Table of Contents

- [Features](#features)
- [Tech Stack](#tech-stack)
- [Role Matrix](#role-matrix)
- [Getting Started](#getting-started)
- [Environment Variables](#environment-variables)
- [Available Scripts](#available-scripts)
- [Project Structure](#project-structure)
- [Security](#security)
- [Contributing](#contributing)

---

## ✨ Features

- **Ticketing System** — IT ticket lifecycle with approval workflows, comments, and activity logs
- **Admin Tickets** — Separate admin-department ticket queue with executive escalation
- **Biometric Attendance** — Real-time sync with PT-5000 / WebSocket devices, SSE live updates
- **Factory Attendance** — Isolated factory user attendance with separate device endpoint
- **Leave Management** — Casual, annual, and medical leave applications with approval hierarchy
- **Site Duty Management** — Field duty applications with department-head approval
- **Notice Board** — Bilingual announcements with outage/maintenance/policy categories
- **User Management** — HQ and factory user administration with role-based access
- **Activity Logging** — Security-focused audit trails for auth events and sensitive mutations

---

## 🛠️ Tech Stack

| Layer          | Technology                                              |
| -------------- | ------------------------------------------------------- |
| **Frontend**   | React 19, TypeScript, Vite, Lucide Icons                |
| **Backend**    | Express 5, TypeScript, SQLite (sqlite3 + sqlite)        |
| **Auth**       | JWT (7d expiry), bcrypt                                 |
| **Real-time**  | Server-Sent Events (SSE), WebSocket (biometric devices) |
| **Security**   | Helmet, CORS, express-rate-limit                        |
| **Deployment** | Docker, Cloudflare Tunnel                               |

---

## 👥 Role Matrix

### HQ Users

| Role                 | Permissions                                                                  |
| -------------------- | ---------------------------------------------------------------------------- |
| **IT Administrator** | Full system access, user management, all tickets, all attendance             |
| **Manager**          | Team tickets, attendance overrides, leave/site-duty approvals, admin tickets |
| **Executive**        | View all tickets, all attendance, site-duty overview                         |
| **Employee**         | Own tickets, own attendance, apply for leave/site-duty                       |

### Factory Users

| Role                 | Permissions                                                 |
| -------------------- | ----------------------------------------------------------- |
| **Factory Manager**  | Factory user management, factory attendance, manual punches |
| **Factory IT**       | Same as Factory Manager                                     |
| **Factory Employee** | Own factory attendance view                                 |

---

## 🚀 Getting Started

### Prerequisites

- **Node.js** >= 20
- **npm** >= 10
- **SQLite** (included via `sqlite3` package)
- Biometric device (optional, for attendance sync)

### Installation

1. **Clone the repository:**

   ```bash
   git clone https://github.com/your-org/harisco-ticketing-system.git
   cd harisco-ticketing-system
   ```

2. **Copy environment file:**

   ```bash
   cp .env.example .env
   # Edit .env with your configuration
   ```

3. **Install dependencies:**

   ```bash
   npm install
   ```

4. **Start development servers:**

   ```bash
   npm run dev
   ```

   This starts:
   - Backend API at `http://localhost:8082`
   - Frontend dev server at `http://localhost:5173`

5. **Initialize database:**
   ```bash
   # The database is created automatically on first run
   # Or run the seed script for factory users:
   npx tsx scripts/seed-factory-users.ts
   ```

---

## 🔧 Environment Variables

See `.env.example` for all available options. Key variables:

| Variable                     | Required | Description                                           |
| ---------------------------- | -------- | ----------------------------------------------------- |
| `JWT_SECRET`                 | Yes      | Secret key for JWT signing (min 64 chars recommended) |
| `ADMIN_INITIAL_PASSWORD`     | Yes      | Bootstrap password for the initial admin user         |
| `VITE_DEFAULT_USER_PASSWORD` | Yes      | Default password for new users                        |
| `PORT`                       | No       | Backend port (default: 8082)                          |
| `DB_PATH`                    | No       | SQLite database path (default: `./database.sqlite`)   |
| `SMTP_*`                     | No       | Email configuration for notifications                 |
| `TUNNEL_TOKEN`               | No       | Cloudflare Tunnel token for external access           |

---

## 📜 Available Scripts

| Command              | Description                                         |
| -------------------- | --------------------------------------------------- |
| `npm run dev`        | Start both backend and frontend in development mode |
| `npm run dev:server` | Start backend only                                  |
| `npm run dev:client` | Start frontend only                                 |
| `npm run build`      | Build frontend for production                       |
| `npm run lint`       | Run ESLint on all files                             |
| `npm run preview`    | Preview production build locally                    |

---

## 📁 Project Structure

```
src/
├── components/          # React components
│   ├── Attendance.tsx
│   ├── TicketList.tsx
│   ├── TicketDetails.tsx
│   ├── UserManagement.tsx
│   └── ...
├── constants.ts         # Shared constants and labels
├── types.ts             # TypeScript type definitions
├── utils.ts             # Utility functions
└── App.tsx              # Main app component

server/
├── index.ts             # Express server (entry point)
├── db.ts                # SQLite database initialization
└── email.ts             # Email service

scripts/
├── seed-factory-users.ts # Seed script for factory users
└── temp_add_indexes.py   # DB migration helper

```

---

## 🔒 Security

- **Authentication:** JWT with 7-day expiration
- **Authorization:** Strict RBAC with role-based route guards
- **Rate Limiting:** Per-user write limits (100/15min), global read limits
- **Input Validation:** Server-side validation on all mutating endpoints
- **Password Storage:** bcrypt with salt rounds
- **SQL Injection:** Parameterized queries exclusively
- **CORS:** Configurable origin whitelist
- **Security Headers:** Helmet.js for CSP, HSTS, and headers

See [SECURITY.md](SECURITY.md) for vulnerability reporting.

---

## 🤝 Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for development workflow, commit conventions, and PR checklist.

---

## 📄 License

This project is proprietary software. See [LICENSE](LICENSE) for details.
