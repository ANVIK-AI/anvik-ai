## setup guide

To run backend and databases through docker run:

```bash
cd backend/ && docker compose up -d && npm run dev
```

open another terminal and run

```bash
cd frontend/ && npm run dev
```

Make sure to do npm install in both directories and also add .env files for both backend and frontend

To access/see database through a prisma UI run:

```bash
cd backend/ && npx prisma studio
```

## Tooling (Husky, lint-staged, ESLint, Prettier, Commitlint)

This repo is configured as a small monorepo with shared tooling at the root:

- Git hooks via Husky
- Staged file checks via lint-staged
- ESLint (flat config) for both backend and frontend
- Prettier with a single root config
- Conventional commits enforced with Commitlint

### One-time setup

At the repo root:

```bash
npm install
```

This installs Husky and creates the `.husky` folder with hooks. If hooks aren't active, run:

```bash
npx husky
```

### ESLint & Prettier commands

- Backend
  - Lint: `npm --prefix backend run lint`
  - Lint (fix): `npm --prefix backend run lint:fix`
  - Format: `npm --prefix backend run format`
  - Format check: `npm --prefix backend run format:check`
  - Typecheck: `npm --prefix backend run typecheck` (may be memory intensive on low-RAM machines)

- Frontend
  - Lint: `npm --prefix frontend run lint`
  - Lint (fix): `npm --prefix frontend run lint:fix`
  - Format: `npm --prefix frontend run format`
  - Format check: `npm --prefix frontend run format:check`
  - Typecheck: `npm --prefix frontend run typecheck`

- Repo-wide convenience
  - Lint (both apps): `npm run lint`
  - Format: `npm run format`
  - Format check: `npm run format:check`

### Pre-commit & commit message checks

- Pre-commit: runs ESLint + Prettier on staged files via lint-staged
- Commit message: validated against Conventional Commits (e.g., `feat: ...`, `fix: ...`)

If you need to bypass hooks (not recommended), you can use `--no-verify`.

### CI

GitHub Actions workflow is located at `.github/workflows/ci.yml` and runs on pushes/PRs to `main`:

- Install dependencies (root, backend, frontend)
- Lint (backend + frontend)
- Typecheck + Build (frontend)
- Prettier check

Note: Backend has heavy type-checking due to generated and third-party types. We've kept backend linting in CI and made strict rules warnings for now; enabling backend type-check/build in CI can be revisited after type performance tuning.
