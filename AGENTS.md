# OpenMkt Engineering Guardrails

OpenMkt is an AGPL-3.0 open-source marketing control plane. Keep the OSS core portable across ordinary Node.js, PostgreSQL, and Docker-compatible infrastructure.

## Architecture

- `Workspace` is the tenancy boundary. Every lookup of workspace-owned data must verify membership/ownership.
- Better Auth provides identity/session infrastructure only. Do not use its organization model as the OpenMkt Workspace domain.
- Business rules belong in Core/application services, not Hono handlers, React components, MCP tools, or provider adapters.
- Provider-specific HTTP/API behavior belongs in provider packages; do not leak raw provider APIs into Core.
- REST, Web, MCP, plugins, and future agent interfaces must call the same Core/change-engine behavior rather than duplicating rules.
- Do not split deployable microservices until operational evidence requires it.
- Avoid speculative abstractions, configurable RBAC, service accounts, billing, provider integrations, or other domains before the approved milestone needs them.

## Development

- Node.js 24 LTS, ESM, TypeScript strict mode, pnpm workspaces, Turborepo.
- Use test-driven development for behavior changes: write the test, observe the expected failure, implement the minimum behavior, then observe green.
- Never commit secrets, `.env` files, tokens, credentials, build outputs, or dependency directories.
- Keep files focused and interfaces explicit. Prefer YAGNI and domain-specific operations over generic escape hatches.

## Mandatory verification

Before claiming a change complete, run the applicable focused tests and then the repository gates:

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm test:integration
pnpm build
```

Database/API changes must also prove committed migrations apply to an empty PostgreSQL database.
