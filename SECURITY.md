# Security Policy

## Reporting a Vulnerability

If you discover a security vulnerability in this repository, please report it responsibly:

1. **Do not** open a public GitHub issue for security vulnerabilities.
2. Email the security team directly at **itdepartment@harisco.com** with:
   - A description of the vulnerability
   - Steps to reproduce it
   - Potential impact assessment
   - Suggested fix (if any)

## Security Measures

This application implements the following security controls:

- **Authentication:** JWT-based auth with 7-day token expiration
- **Authorization:** Role-based access control (RBAC) with strict permission matrices
- **Rate Limiting:** Per-user and per-IP rate limiters on all API routes
- **Input Validation:** Server-side validation on all mutating endpoints
- **Password Storage:** bcrypt hashing with salt rounds
- **SQL Injection Prevention:** Parameterized queries throughout
- **CORS Restriction:** Configurable origin whitelist
- **Security Headers:** Helmet.js for CSP, HSTS, and other headers

## Data Handling

- Attendance data is stored in SQLite with indexed queries
- Biometric device data is processed server-side; no biometric templates are stored
- All sensitive mutations (user creation, role changes, manual attendance edits) are logged

## Incident Response

In case of a security incident:

1. Isolate the affected component
2. Preserve logs for forensic analysis
3. Rotate compromised credentials
4. Apply patches and verify fixes
5. Notify affected users if personal data was accessed
