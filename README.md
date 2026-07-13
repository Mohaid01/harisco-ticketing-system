# Internal Operations Portal (Ticketing, Attendance & Site-Duty)

A unified web application designed to streamline internal company operations, featuring a robust, role-based access control system for ticketing management, biometric-synced attendance tracking, and field application workflows.

---

## 👥 Role-Based Access Control Matrix

The platform strictly enforces the following permissions across four distinct user roles:

### 1. Executives

- **Ticketing:** View all system tickets + Raise new tickets.
- **Attendance:** Exempt from biometric scanning. Access to view complete global company attendance records.
- **Site-Duty:** Exempt from applying. Access to view all employee application data.

### 2. Managers

- **Ticketing:** View own tickets + Raise new tickets.
- **Attendance:** Manually edit team attendance records + Add gazetted holidays.
- **Site-Duty:** Apply for own site-duty + Approve/Reject applications from team members.

### 3. IT Staff

- **Ticketing:** Review, address, and manage all global tickets + Raise new tickets.
- **Attendance:** View own personal attendance records only.
- **Site-Duty:** Apply for own site-duty.

### 4. Employees

- **Ticketing:** View own tickets + Raise new tickets.
- **Attendance:** View own personal attendance records only.
- **Site-Duty:** Apply for own site-duty.

---

## 🛠️ Core Module Specifications

### 🎫 1. Ticketing System

- **Actionable Workflows:** Employees and Managers raise operational requests, which are processed globally by the IT staff.
- **Executive Oversight:** Executives maintain a high-level view of all issues without administrative bottlenecks.

### 🕒 2. Biometric Attendance Integration

- **Device Syncing:** Automatically fetches clock-in and clock-out timestamps from physical biometric devices.
- **Exemption Logic:** The system intentionally excludes Executive profiles from the scan-in/out check protocols.
- **Administrative Overrides:** Allows Managers to correct missing punches or add calendar holidays.

### 🚗 3. Application & Site-Duty Workflows

- **Approval Hierarchy:** Applications submitted by Employees or IT staff must be reviewed and approved by their relevant Department Head or Manager.

---

## 🚀 Getting Started

### Prerequisites

- [Database Engine] (e.g., PostgreSQL >= 15 / MySQL >= 8)
- [Runtime Environment] (e.g., Node.js >= 20 / Python >= 3.11)
- Network connection to the Biometric Hardware Terminal API.

### Installation & Local Setup

1. **Clone the repository:**

   ```bash
   git clone https://github.com/Mohaid01/harisco-ticketing-system.git
   cd harisco-ticketing-system
   ```

2. **Configure Environment Variables:**
   Create a `.env` file in the root directory and add your configurations:

   ```env
   PORT=8080
   DATABASE_URL=your_database_connection_string
   ...
   ```

3. **Install Dependencies & Start:**

   ```bash
   # Install backend/frontend packages
   npm install

   # Start the development server
   npm run dev
   ```

---

## 🔒 Security & Implementation Note

All endpoints check user session tokens against the matrix outlined above. Any unauthorized attempts to access cross-department tickets, alter attendance records outside of a manager role, or bypass application workflows will trigger a `403 Forbidden` log entry.
