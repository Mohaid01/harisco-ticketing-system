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
- **User Management** — HQ and factory user administration with role-based access and offboarding
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

### Deployment & Database

| Command                                    | Description                                      |
| ------------------------------------------ | ------------------------------------------------ |
| `bash deploy.sh`                           | Deploy latest code with automatic DB backup      |
| `bash scripts/backup-db.sh`                | Manual database backup (to `backups/` directory) |
| `bash scripts/restore-db.sh <backup-file>` | Restore database from backup                     |

**Rollback:** If deployment fails, `deploy.sh` automatically rolls back to the previous Docker image tagged `harisco-ticketing-system:rollback`.

---

## 🗄️ Database Backup & Restore

The SQLite database is stored in `data/database.sqlite`. Always back up before deploying or migrating.

### Backup

```bash
# Automatic (included in deploy.sh)
bash deploy.sh

# Manual
bash scripts/backup-db.sh
# Backups are stored in backups/ with timestamps
```

### Restore

```bash
# Stop the running container
docker compose stop harisco-ticketing-system

# Restore from a specific backup
bash scripts/restore-db.sh backups/database-20260807-120000.sqlite

# Or start the container again
docker compose start harisco-ticketing-system
```

### Important Notes

- The `data/` directory is bind-mounted in Docker (`./data:/app/data`)
- Never delete `data/` without backing up first
- For production, schedule daily backups via cron:
  ```bash
  0 2 * * * cd /path/to/repo && bash scripts/backup-db.sh
  ```

## 📁 Project Structure

```
├── .github/
│   ├── ISSUE_TEMPLATE/     # Issue templates (bug report, feature request)
│   ├── PULL_REQUEST_TEMPLATE/
│   └── dependabot.yml      # Automated dependency updates
├── server/
│   ├── index.ts            # Express server (entry point)
│   ├── db.ts               # SQLite database initialization
│   ├── routes/             # API route handlers
│   ├── services/           # Business logic (punch processors, etc.)
│   ├── middleware/         # Auth, rate limiting, SSE
│   └── utils/              # Logger, helpers
├── src/
│   ├── components/         # React components
│   │   ├── Attendance.tsx
│   │   ├── TicketList.tsx
│   │   ├── TicketDetails.tsx
│   │   ├── UserManagement.tsx
│   │   └── ...
│   ├── utils/              # Shift calculations, formatters
│   ├── constants.ts        # Shared constants and labels
│   ├── types.ts            # TypeScript type definitions
│   └── App.tsx             # Main app component
├── scripts/
│   ├── seed-factory-users.ts # Seed script for factory users
│   ├── backup-db.sh        # Database backup script
│   └── restore-db.sh       # Database restore script
├── data/                   # SQLite database (bind-mounted in Docker)
├── backups/                # Database backups
├── logs/                   # Docker container logs
├── dist/                   # Vite production build output
├── Dockerfile              # Multi-stage production build
├── docker-compose.yml      # Container orchestration
├── deploy.sh               # Deployment script with rollback
└── docker-start.sh         # Container entrypoint (permission fix)
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
