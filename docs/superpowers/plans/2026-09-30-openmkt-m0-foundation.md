# OpenMkt M0 Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the first self-hostable OpenMkt foundation: portable TypeScript monorepo, Hono server, React Web app, PostgreSQL/Drizzle persistence, Better Auth, Workspace tenancy, base audit trail, Docker deployment, and CI gates.

**Architecture:** `apps/server` owns HTTP delivery, `apps/web` owns browser UI, and reusable business/infrastructure code lives in packages. Better Auth owns identity/session mechanics; OpenMkt Core owns Workspace membership and authorization. M0 deliberately excludes Google providers, MCP, Change Engine, Cloud billing, and in-Web LLM providers.

**Tech Stack:** Node.js 24 LTS, TypeScript strict, pnpm workspaces, Turborepo, Hono, React + Vite + React Router + TanStack Query, PostgreSQL, Drizzle ORM, Better Auth, Zod, Vitest, Docker Compose.

**Spec:** `docs/superpowers/specs/2026-09-30-openmkt-architecture-design.md`

## Global Constraints

- AGPL-3.0 for core and first-party applications.
- OSS must run with ordinary Node.js + PostgreSQL + Docker-compatible infrastructure; no mandatory proprietary service.
- `Workspace` is the tenancy boundary. Every workspace-owned lookup verifies membership.
- Better Auth must not own the Workspace domain; do not enable/use its organization model for tenancy.
- Email/password auth must work without Google/GitHub OAuth.
- Hono handlers parse/authorize/serialize only; business rules stay in Core.
- ESM only; TypeScript strict mode.
- OpenMkt IDs use `crypto.randomUUID()` strings; no PostgreSQL UUID extension is required.
- API errors must not leak whether an inaccessible Workspace exists.
- Never commit or log secrets.
- Do not add Google Ads/GA4/GTM, MCP, Change Engine, billing, service accounts, configurable RBAC, LLM APIs, or microservices in M0.

## Review Focus

1. **Cross-workspace access:** member of Workspace A requesting Workspace B gets the same `404 WORKSPACE_NOT_FOUND` envelope as a nonexistent Workspace. Covered in Tasks 4 and 6.
2. **Missing/expired session:** protected API returns `401 UNAUTHENTICATED`; no principal is created. Covered in Tasks 3 and 6.
3. **Duplicate tenancy records:** duplicate workspace slug and duplicate `(workspaceId,userId)` membership fail at the database boundary. Covered in Tasks 2 and 4.
4. **Partial OAuth config:** only client ID or only client secret for optional Google/GitHub auth fails environment validation. Covered in Task 3.
5. **Unavailable/stale database:** migrations against an empty DB succeed; startup aborts clearly when database/config is invalid. Covered in Tasks 2, 8, and 9.

---

## Locked File Map

```text
apps/server/src/{app.ts,env.ts,index.ts,http-errors.ts}
apps/server/src/middleware/session.ts
apps/server/src/routes/{auth.ts,me.ts,workspaces.ts,audit-events.ts}
apps/web/src/{app.tsx,main.tsx,styles.css}
apps/web/src/lib/{api.ts,auth-client.ts}
apps/web/src/pages/{login-page.tsx,workspace-list-page.tsx,workspace-page.tsx}
apps/web/src/components/create-workspace-form.tsx
packages/contracts/src/{errors.ts,me.ts,workspaces.ts}
packages/database/src/{client.ts,index.ts}
packages/database/src/schema/{auth.ts,openmkt.ts,index.ts}
packages/database/src/repositories/{workspace-repository.ts,audit-repository.ts}
packages/auth/better-auth.config.ts
packages/auth/src/{options.ts,auth.ts,index.ts}
packages/core/src/{id.ts,principal.ts}
packages/core/src/workspaces/{types.ts,repository.ts,service.ts}
packages/core/src/audit/{types.ts,service.ts}
docker/{Dockerfile.server,Dockerfile.web,nginx.conf}
.github/workflows/ci.yml
LICENSE
AGENTS.md
README.md
.env.example
package.json
pnpm-workspace.yaml
turbo.json
tsconfig.base.json
eslint.config.js
```

---

### Task 1: Monorepo, license, and health server

**Files:**
- Create: root tooling/config files listed above.
- Create: `apps/server/package.json`, `apps/server/tsconfig.json`, `apps/server/src/app.ts`, `apps/server/src/index.ts`, `apps/server/test/health.test.ts`.

**Interfaces:**
- Produces `createApp(): Hono` for the initial health-only app.
- Produces root commands `lint`, `typecheck`, `test`, `test:integration`, `build`.

- [ ] **Step 1: Write failing health test**

`health.test.ts` must assert `GET /healthz` returns `200` and `{ status: "ok" }`.

- [ ] **Step 2: Run focused test; verify failure**

`pnpm --filter @openmkt/server test -- health.test.ts`

Expected: FAIL because the server package does not exist.

- [ ] **Step 3: Scaffold root monorepo**

Root package: `private: true`, ESM, Node engine `>=24 <25`; pnpm workspaces + Turbo; strict TS; ESLint flat config; Vitest; build via a small ESM bundler such as `tsup` while `tsc --noEmit` remains the typecheck gate.

- [ ] **Step 4: Add AGPL-3.0 and `AGENTS.md`**

`AGENTS.md` must record the architectural constraints above plus TDD and mandatory root verification gates.

- [ ] **Step 5: Implement health server**

`createApp()` registers only `GET /healthz`. `index.ts` starts Hono with `@hono/node-server` on `PORT`, default `3001`.

- [ ] **Step 6: Verify**

```bash
pnpm --filter @openmkt/server test -- health.test.ts
pnpm lint
pnpm typecheck
pnpm build
```

Expected: PASS.

- [ ] **Step 7: Commit**

`git commit -m "chore: scaffold OpenMkt foundation"`

---

### Task 2: Database, Better Auth schema generation, and initial migration

**Files:**
- Create: `packages/database/**` from Locked File Map plus `drizzle.config.ts`, `migrations/`, integration tests.
- Create: `packages/auth/package.json`, `packages/auth/tsconfig.json`, `packages/auth/better-auth.config.ts`, `packages/auth/src/options.ts`, `packages/auth/src/auth.ts`, `packages/auth/src/index.ts`.

**Interfaces:**

```ts
createDatabase(databaseUrl: string): OpenMktDatabase
buildAuthOptions(input: AuthOptionsInput): BetterAuthOptions
createAuth(input: CreateAuthInput): BetterAuthInstance
```

`better-auth.config.ts` exists only so the Better Auth CLI can generate schema without requiring a live runtime DB connection. Runtime code imports the same shared `buildAuthOptions()`.

- [ ] **Step 1: Write failing DB constraint integration test**

Against PostgreSQL, assert:

```ts
expect(insertDuplicateWorkspaceSlug()).rejects.toThrow()
expect(insertDuplicateWorkspaceMembership()).rejects.toThrow()
```

Also assert one auth user, workspace, and owner membership can be inserted/selected.

- [ ] **Step 2: Run; verify failure**

`pnpm --filter @openmkt/database test:integration -- schema.integration.test.ts`

- [ ] **Step 3: Implement database factory**

`createDatabase(databaseUrl)` uses Drizzle + `node-postgres` and does not read `process.env` internally.

- [ ] **Step 4: Add shared Better Auth options and CLI config**

Email/password enabled; no Better Auth organizations. `better-auth.config.ts` must be loadable by the current official Better Auth CLI with `--adapter drizzle --dialect postgresql` and output to `packages/database/src/schema/auth.ts`.

- [ ] **Step 5: Generate auth schema**

Use current official Better Auth CLI, noninteractive, output exactly `packages/database/src/schema/auth.ts`. Prefer PostgreSQL schema namespace `auth` when supported by the current adapter/CLI.

- [ ] **Step 6: Implement OpenMkt tables**

`openmkt.ts` defines:

```text
workspaces: id, name, slug UNIQUE, createdAt, updatedAt
workspace_members: workspaceId, userId, role, createdAt
  role = owner | admin | member | viewer
  UNIQUE/PK(workspaceId,userId)
audit_events: id, workspaceId, actorType, actorId, action,
  resourceType, resourceId?, metadata JSONB, createdAt
```

`workspace_members.userId` references the generated Better Auth user table. Workspace FKs cascade on workspace deletion.

- [ ] **Step 7: Generate/apply migration**

```bash
pnpm --filter @openmkt/database db:generate -- --name=init
pnpm --filter @openmkt/database db:migrate
```

Expected: empty PostgreSQL DB migrates successfully.

- [ ] **Step 8: Run integration tests**

`pnpm --filter @openmkt/database test:integration`

Expected: PASS including duplicate constraints.

- [ ] **Step 9: Commit**

`git commit -m "feat: add database and auth schema foundation"`

---

### Task 3: Better Auth runtime and session middleware

**Files:**
- Modify: `packages/auth/src/{options.ts,auth.ts,index.ts}`.
- Create: `packages/auth/test/config.test.ts`.
- Create: `apps/server/src/env.ts`, `apps/server/src/middleware/session.ts`, `apps/server/src/routes/auth.ts`, `apps/server/test/auth.integration.test.ts`.
- Modify: `apps/server/src/app.ts`.

**Interfaces:**

```ts
type OAuthClient = { clientId: string; clientSecret: string }

createAuth(input: {
  db: OpenMktDatabase
  baseURL: string
  secret: string
  trustedOrigins: string[]
  google?: OAuthClient
  github?: OAuthClient
}): BetterAuthInstance

parseServerEnv(input: NodeJS.ProcessEnv): ServerEnv
requireSession(c): AuthSession
```

- [ ] **Step 1: Write failing config tests**

Partial Google/GitHub credential pairs throw; valid email/password-only config succeeds.

- [ ] **Step 2: Write failing unauthenticated session test**

Protected probe using session middleware returns `401`, with no user/principal attached.

- [ ] **Step 3: Run; verify failure**

```bash
pnpm --filter @openmkt/auth test
pnpm --filter @openmkt/server test:integration -- auth.integration.test.ts
```

- [ ] **Step 4: Implement server env validation**

Validate `DATABASE_URL`, `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`, `APP_ORIGIN`, optional social OAuth pairs, and `PORT` with Zod. Fail before listening.

- [ ] **Step 5: Complete Better Auth runtime**

Use Drizzle adapter + generated schema, email/password, trusted origins, and optional social providers. Do not configure organizations.

- [ ] **Step 6: Mount Better Auth and session middleware**

Forward `/api/auth/*` to `auth.handler(c.req.raw)`. When dev origins differ, CORS uses explicit `APP_ORIGIN` and `credentials: true`. Session middleware uses `auth.api.getSession({ headers })`.

- [ ] **Step 7: Verify and commit**

All Task 3 tests pass.

`git commit -m "feat: add portable user authentication"`

---

### Task 4: Workspace Core and database repository

**Files:**
- Create: `packages/core/**` workspace files from Locked File Map plus unit tests.
- Create: `packages/database/src/repositories/workspace-repository.ts` plus integration test.

**Interfaces:**

```ts
type WorkspaceRole = "owner" | "admin" | "member" | "viewer"
type UserPrincipal = { type: "user"; userId: string }

interface WorkspaceRepository {
  createWithOwner(input: {
    workspace: { id: string; name: string; slug: string }
    ownerUserId: string
  }): Promise<Workspace>
  listForUser(userId: string): Promise<WorkspaceSummary[]>
  findMembership(input: {
    workspaceId: string
    userId: string
  }): Promise<WorkspaceMembershipView | null>
}

class WorkspaceService {
  createWorkspace(input: { principal: UserPrincipal; name: string; slug: string }): Promise<Workspace>
  listWorkspaces(principal: UserPrincipal): Promise<WorkspaceSummary[]>
  requireMembership(input: { principal: UserPrincipal; workspaceId: string }): Promise<WorkspaceMembershipView>
}
```

- [ ] **Step 1: Write failing Core tests**

Assert create uses `owner`; list is user-scoped; nonexistent and inaccessible workspace both cause the same `WorkspaceNotFoundError`.

- [ ] **Step 2: Run; verify failure**

`pnpm --filter @openmkt/core test -- workspaces/service.test.ts`

- [ ] **Step 3: Implement Core types/service**

Use `crypto.randomUUID()`. Validate nonempty name and normalized slug format before repository call.

- [ ] **Step 4: Implement Drizzle repository**

`createWithOwner()` inserts workspace + owner membership in one PostgreSQL transaction. `findMembership()` always filters by both workspace and user.

- [ ] **Step 5: Write/run repository isolation tests**

User A querying membership in existing Workspace B returns `null`; duplicate membership fails.

`pnpm --filter @openmkt/database test:integration -- workspace-repository.integration.test.ts`

- [ ] **Step 6: Verify and commit**

`pnpm --filter @openmkt/core test`

`git commit -m "feat: add workspace tenancy domain"`

---

### Task 5: Base audit service

**Files:**
- Create: `packages/core/src/audit/{types.ts,service.ts}` plus unit test.
- Create: `packages/database/src/repositories/audit-repository.ts` plus integration test.
- Modify: `packages/core/src/workspaces/service.ts` and tests.

**Interfaces:**

```ts
type AuditActor = { type: "user"; id: string }

interface AuditRepository {
  append(event: AuditEventInput): Promise<void>
  list(input: { workspaceId: string; limit: number; before?: string }): Promise<AuditEvent[]>
}

class AuditService {
  record(input: AuditEventInput): Promise<void>
  listForWorkspace(input: { workspaceId: string; limit?: number; before?: string }): Promise<AuditEvent[]>
}
```

- [ ] **Step 1: Write failing audit tests**

`record()` forwards structured event; list defaults to `50` and clamps to `100`; secret-like fields are not part of the event contract.

- [ ] **Step 2: Run; verify failure**

`pnpm --filter @openmkt/core test -- audit/service.test.ts`

- [ ] **Step 3: Implement audit service/repository**

Use JSONB metadata and workspace-scoped query. Cursor can be internal `createdAt + id`; no offset contract.

- [ ] **Step 4: Record workspace creation**

After successful `createWithOwner()`, WorkspaceService records:

```text
action=workspace.created
resourceType=workspace
resourceId=<workspace id>
actorType=user
actorId=<owner user id>
```

M0 accepts write-then-audit sequencing; atomic provider mutations and audit orchestration are deferred to the M2 Change Engine.

- [ ] **Step 5: Verify and commit**

```bash
pnpm --filter @openmkt/core test
pnpm --filter @openmkt/database test:integration -- audit-repository.integration.test.ts
```

`git commit -m "feat: add workspace audit trail foundation"`

---

### Task 6: Typed REST API

**Files:**
- Create: `packages/contracts/**` from Locked File Map.
- Create: `apps/server/src/http-errors.ts` and routes `me.ts`, `workspaces.ts`, `audit-events.ts`.
- Create: `apps/server/test/workspaces.integration.test.ts`.
- Modify: `apps/server/src/app.ts`.

**Interfaces:**

```text
GET  /api/me
GET  /api/workspaces
POST /api/workspaces
GET  /api/workspaces/:workspaceId
GET  /api/workspaces/:workspaceId/audit-events
```

Create input: `{ name: string; slug: string }`

Error envelope: `{ error: { code: string; message: string } }`

- [ ] **Step 1: Write failing API integration tests**

Assert:

```text
GET /api/me unauthenticated -> 401 UNAUTHENTICATED
POST /api/workspaces authenticated -> 201
GET /api/workspaces -> only current user's workspaces
GET inaccessible workspace -> 404 WORKSPACE_NOT_FOUND
GET nonexistent workspace -> identical 404 body
GET audit-events -> includes workspace.created
```

- [ ] **Step 2: Run; verify failure**

`pnpm --filter @openmkt/server test:integration -- workspaces.integration.test.ts`

- [ ] **Step 3: Implement shared Zod contracts and error mapping**

`400 INVALID_REQUEST`, `401 UNAUTHENTICATED`, `404 WORKSPACE_NOT_FOUND`; never return stack traces.

- [ ] **Step 4: Implement thin Hono routes**

Routes parse request, require session, call Core services, serialize contracts. No membership SQL or tenancy rules in handlers.

- [ ] **Step 5: Verify and commit**

`pnpm --filter @openmkt/server test:integration -- workspaces.integration.test.ts`

`git commit -m "feat: expose workspace foundation API"`

---

### Task 7: React Web workspace shell

**Files:**
- Create: `apps/web/**` from Locked File Map plus Vite config, package/tsconfig, tests.

**Interfaces:**
- Uses Better Auth `/api/auth/*`.
- Uses Task 6 REST contracts.
- Routes: `/login`, `/`, `/workspaces/:workspaceId` using React Router.

- [ ] **Step 1: Write failing UI tests**

Assert:

```text
no session -> login page
session + no workspaces -> create form
session + workspaces -> workspace names shown
workspace page -> workspace.created audit event shown when API returns it
```

Mock only `auth-client.ts` and `api.ts` boundaries.

- [ ] **Step 2: Run; verify failure**

`pnpm --filter @openmkt/web test`

- [ ] **Step 3: Scaffold Web app**

React + Vite + React Router + TanStack Query. No design system in M0; plain focused CSS.

- [ ] **Step 4: Implement auth/API clients**

Better Auth React client; API uses relative `/api` in production, configurable dev server base URL, and `credentials: "include"`.

- [ ] **Step 5: Implement email/password auth and workspace screens**

Sign up/sign in, list/create workspace, workspace detail shell, audit list. Do not add provider/MCP/LLM UI.

- [ ] **Step 6: Verify and commit**

```bash
pnpm --filter @openmkt/web test
pnpm --filter @openmkt/web typecheck
pnpm --filter @openmkt/web build
```

`git commit -m "feat: add authenticated workspace web shell"`

---

### Task 8: Portable Docker self-hosting

**Files:**
- Create: `docker/Dockerfile.server`, `docker/Dockerfile.web`, `docker/nginx.conf`, `docker-compose.yml`.
- Create: `apps/server/test/startup.test.ts`.
- Modify: `.env.example`, `README.md`.

**Interfaces:**
- Compose services: `postgres`, `server`, `web`.
- Browser origin is the `web` nginx container.

- [ ] **Step 1: Write failing startup validation test**

Missing/invalid `DATABASE_URL` must fail before HTTP listen begins.

- [ ] **Step 2: Run; verify failure**

`pnpm --filter @openmkt/server test -- startup.test.ts`

- [ ] **Step 3: Add production Dockerfiles**

Node 24 multi-stage server build; Web Vite build served by nginx. Never use Vite dev/preview as production server.

- [ ] **Step 4: Configure nginx**

Serve SPA and proxy these paths to `server:3001`:

```text
/healthz
/api/*
/mcp
/.well-known/*
```

`/mcp` and `/.well-known/*` are reserved pass-throughs only; M0 does not implement MCP.

- [ ] **Step 5: Add Compose startup/migration flow**

PostgreSQL healthcheck; server waits for DB and applies committed migrations before starting HTTP. Migration failure stops the server container.

- [ ] **Step 6: Document bootstrap**

README: copy `.env.example` to `.env`, generate Better Auth secret, `docker compose up --build`, open Web URL, create first user/workspace.

- [ ] **Step 7: Verify clean boot**

```bash
docker compose down -v
docker compose up --build -d
docker compose ps
curl -fsS http://localhost:3000/healthz
```

Expected: services running and `{ "status": "ok" }` through nginx.

- [ ] **Step 8: Commit**

`git commit -m "feat: add portable Docker self-hosting"`

---

### Task 9: CI and M0 acceptance

**Files:**
- Create: `.github/workflows/ci.yml`.
- Modify: `README.md`; modify `AGENTS.md` only if verified commands differ.

**Interfaces:**
- CI uses Node 24 + PostgreSQL service and reproduces local gates.

- [ ] **Step 1: Add CI workflow**

Use Corepack/pnpm, `pnpm install --frozen-lockfile`, migrate an empty PostgreSQL service, then run all gates.

- [ ] **Step 2: Run exact gates locally**

```bash
pnpm install --frozen-lockfile
pnpm lint
pnpm typecheck
pnpm test
pnpm --filter @openmkt/database db:migrate
pnpm test:integration
pnpm build
```

Expected: all PASS.

- [ ] **Step 3: Verify user path in Docker**

```text
sign up -> sign in -> create OpenMkt Demo/openmkt-demo
-> see workspace -> open workspace -> see workspace.created audit event
-> sign out -> protected workspace API returns 401
```

- [ ] **Step 4: Verify isolation**

Two users/two workspaces: User A receives identical `404 WORKSPACE_NOT_FOUND` for User B's workspace ID and a nonexistent ID.

- [ ] **Step 5: Secret/artifact check**

Confirm `.env`, tokens, dependency directories, build caches, and local DB files are untracked.

- [ ] **Step 6: Commit**

`git commit -m "ci: verify OpenMkt foundation"`

---

## M0 Definition of Done

1. `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm test:integration`, and `pnpm build` pass.
2. Migrations apply to an empty PostgreSQL DB.
3. `docker compose up --build` boots without proprietary managed dependencies.
4. Email/password sign-up and sign-in work.
5. Authenticated user can create/list/open Workspaces.
6. Workspace creation creates owner membership and `workspace.created` audit event.
7. Cross-workspace/nonexistent Workspace IDs share the same 404 shape.
8. Web UI supports login, workspace list/create, workspace shell, and audit visibility.
9. Better Auth organization tenancy is not used.
10. No Google/MCP/Change Engine/Cloud billing/LLM-provider code exists in M0.
11. CI reproduces the gates on Node 24 + PostgreSQL.
12. Repository remains AGPL-3.0 and vendor-neutral.

## Follow-on Plans

Write a separate plan before each subsequent subsystem:

1. **M1 — Google Read + Provider Connections:** encrypted credential store, Google OAuth, Google Ads/GA4/GTM discovery/read adapters, REST/Web read views, workspace-scoped MCP OAuth and read tools.
2. **M2 — Change Engine:** plan/diff/risk/confirmation/idempotency/execute/verify/audit lifecycle.
3. **M3 — Google Write:** full campaign construction including budgets, bidding, targeting, ad groups, creative/assets, keywords, audiences/segments, conversions/goals, GA4 configuration, GTM mutation/version/publish.
4. **M4 — OpenMkt Cloud:** managed deployment, KMS/secrets, billing/quotas, backups, monitoring, managed OAuth clients.
5. **M5 — ChatGPT Plugin:** official plugin over existing OpenMkt MCP with reusable skills and interactive change-review/confirmation surfaces.
