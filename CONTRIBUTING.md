# Contributing to Harisco Ticketing System

Thank you for your interest in contributing to this internal operations portal. This document outlines the workflow and standards we follow.

## Table of Contents

- [Code of Conduct](#code-of-conduct)
- [Getting Started](#getting-started)
- [Development Workflow](#development-workflow)
- [Commit Convention](#commit-convention)
- [Pull Request Checklist](#pull-request-checklist)
- [Coding Standards](#coding-standards)

## Code of Conduct

- Be respectful and inclusive
- Focus on constructive feedback
- Follow the established patterns in the codebase

## Getting Started

1. Clone the repository
2. Copy `.env.example` to `.env` and fill in required values
3. Run `npm install`
4. Start the dev server: `npm run dev`
5. Verify the app loads at `http://localhost:{PORT}`

## Development Workflow

1. **Create a branch** from `main`:

   ```bash
   git checkout -b feature/your-feature-name
   # or
   git checkout -b fix/your-bug-fix
   ```

2. **Make your changes** and ensure:
   - `npm run lint` passes
   - `npm run build` succeeds
   - Manual testing covers the changed functionality

3. **Commit with a conventional commit message**:

   ```
   feat(attendance): add export to CSV functionality
   fix(login): handle disabled account response correctly
   docs(readme): update setup instructions for Windows
   ```

4. **Push and open a Pull Request** against `main`

5. **Address review feedback** and request re-review

## Commit Convention

We follow [Conventional Commits](https://www.conventionalcommits.org/):

- `feat:` new feature
- `fix:` bug fix
- `docs:` documentation changes
- `style:` formatting, missing semicolons, etc.
- `refactor:` code change that neither fixes a bug nor adds a feature
- `perf:` performance improvement
- `test:` adding or updating tests
- `chore:` maintenance tasks, dependency updates

## Pull Request Checklist

Before submitting a PR, ensure:

- [ ] Code compiles without errors (`npm run build`)
- [ ] Lint passes (`npm run lint`)
- [ ] New features are tested manually
- [ ] Sensitive data (passwords, tokens, keys) are not committed
- [ ] Environment variables are documented in `.env.example`
- [ ] README is updated if user-facing behavior changes
- [ ] Database migrations are included if schema changes

## Coding Standards

- **TypeScript:** Use strict typing. Avoid `any`; use `unknown` with type guards if needed.
- **Backend:** Keep route handlers thin. Business logic goes in service functions.
- **Frontend:** Functional components with hooks. Avoid class components.
- **Error Handling:** Use try/catch with meaningful error messages. Log security events.
- **Database:** Use parameterized queries. Never concatenate user input into SQL.
