# AGENTS.md

## Mission
Build and maintain a local-first, open-source AI personal command center with privacy-first defaults.

## Coding Standards

### General
- Prefer small, composable modules and clear naming.
- Keep changes minimal and focused.
- Add or update README/docs when adding developer workflows.
- Avoid introducing proprietary or closed-source dependencies.

### Frontend (`apps/web`)
- Use TypeScript with strict mode where practical.
- Prefer functional React components.
- Use Tailwind utility classes for styling.
- Keep UI components reusable and presentation-focused.

### Backend (`apps/api`)
- Use FastAPI with pydantic models.
- Keep route handlers thin; isolate business logic into modules as app grows.
- Expose `/health` for service readiness checks.

### Shared (`packages/shared`)
- Keep shared types framework-agnostic.
- Version breaking changes carefully.

### Infra (`infra`)
- Pin stable container images when possible.
- Keep local defaults explicit via environment variables.

## Quality Gates
- Ensure web app installs, lints, and builds.
- Ensure API starts and `/health` responds.
- Keep CI green.
