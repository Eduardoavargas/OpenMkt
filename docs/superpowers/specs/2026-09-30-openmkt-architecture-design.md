# OpenMkt — Architecture Design

Status: approved design, pending implementation plan
Date: 2026-09-30
License: AGPL-3.0 for the OpenMkt core and first-party applications
Repository: `Eduardoavargas/OpenMkt`

## 1. Product definition

OpenMkt is an open-source marketing control plane for humans and AI agents.

It provides a single domain layer over marketing and analytics platforms so users can inspect, analyze, create, edit, validate, publish, and audit marketing resources without exposing raw provider APIs as the primary product interface.

The project has two distributions:

- **OpenMkt OSS** — self-hostable, portable, fully functional under AGPL-3.0.
- **OpenMkt Cloud** — the official managed SaaS using the same core, monetizing managed infrastructure, security, reliability, quotas, support, and enterprise capabilities rather than withholding essential product functionality from the open-source edition.

The first provider family is Google:

- Google Ads;
- Google Analytics 4;
- Google Tag Manager.

Future providers may include Meta Ads, TikTok Ads, Microsoft Ads, Search Console, Merchant Center, LinkedIn Ads, and others. New providers must plug into OpenMkt through explicit capabilities rather than by leaking provider-specific APIs through the core.

The first agent interface is MCP. MCP is an interface to OpenMkt, not the product domain itself. The same domain and change engine must serve the Web application, REST API, MCP clients, ChatGPT plugins, other agents, and future automation surfaces.

## 2. Product principles

### 2.1 Portable open source core

OpenMkt OSS must not require a specific cloud vendor. A user should be able to run the product with ordinary Node.js, PostgreSQL, and Docker-compatible infrastructure.

Cloud-specific optimizations belong to OpenMkt Cloud or replaceable infrastructure adapters.

### 2.2 Workspace is the tenancy boundary

`Workspace` is the primary isolation boundary from v1. Provider connections, external accounts, MCP grants, API keys, audit events, settings, and future billing state are always workspace-scoped.

No provider credential or resource may be resolved only by a global ID without verifying workspace ownership.

### 2.3 Core before interfaces

Provider APIs are adapted into OpenMkt capabilities. REST, MCP, Web, plugins, CLI, and future automations consume the same application/core layer.

Business rules must not be duplicated in MCP tools or Web handlers.

### 2.4 Control plane, not read-only dashboard

Read-only reporting is the first integration milestone, not the final product scope.

OpenMkt is explicitly designed to perform controlled mutations including:

- create/edit/pause/resume campaigns;
- create/edit campaign budgets and supported bidding configuration;
- create/edit ad groups, ads/creatives, assets, keywords, and negative keywords;
- create/edit targeting supported by the provider, including audiences/segments and other targeting dimensions when modeled safely;
- create/edit audiences and provider-specific segments;
- create/edit conversion actions;
- configure account and campaign conversion goals;
- create/edit GA4 key events and supported analytics configuration;
- create/edit GTM tags, triggers, and variables;
- create GTM versions and publish approved versions;
- equivalent write capabilities for future providers when their APIs support them.

“Create campaign” means producing the provider resources required for a usable campaign configuration, not merely creating an empty campaign object. The exact resource graph remains provider-specific and is assembled through typed capabilities/change plans.

### 2.5 Intent-level safety

OpenMkt must not expose a generic unrestricted `mutate(anything)` surface in the default Cloud/MCP product.

Meaningful writes follow:

`Plan -> Read current state -> Validate -> Diff/Preview -> Confirm -> Execute -> Verify -> Audit`

High-impact writes require stronger confirmation than low-risk writes.

### 2.6 Normalize only true equivalence

OpenMkt should normalize concepts and metrics only when they are semantically comparable.

Provider-specific details must remain available through typed provider extensions rather than being discarded or forced into a misleading universal model.

## 3. Initial stack

### Monorepo

- Node.js 24 LTS
- TypeScript strict mode
- pnpm workspaces
- Turborepo

### Server

- Hono
- Node.js runtime
- REST API
- OAuth/auth endpoints
- MCP Streamable HTTP endpoint

### Web

- React
- Vite
- TanStack Query

### Data

- PostgreSQL
- Drizzle ORM
- node-postgres

### Validation/contracts

- Zod
- shared typed contracts package

### Testing

- Vitest for unit/integration tests
- provider HTTP mocks for deterministic tests
- browser/E2E tooling added when Web flows justify it

### Self-hosting

- Dockerfiles
- Docker Compose
- environment-based configuration
- no mandatory managed service dependency

## 4. Monorepo structure

Initial target structure:

```text
OpenMkt/
├─ apps/
│  ├─ server/
│  └─ web/
│
├─ packages/
│  ├─ core/
│  ├─ contracts/
│  ├─ database/
│  ├─ auth/
│  ├─ mcp/
│  ├─ change-engine/
│  └─ providers/
│     ├─ google-ads/
│     ├─ google-analytics/
│     └─ google-tag-manager/
│
├─ docs/
├─ docker/
├─ docker-compose.yml
├─ pnpm-workspace.yaml
└─ turbo.json
```

Do not split API, MCP, workers, or provider services into separate deployable microservices until operational evidence justifies it.

The initial `apps/server` process serves REST, auth/OAuth, and MCP.

## 5. Identity, workspaces, and authorization

### 5.1 User identity

Use Better Auth as authentication infrastructure, not as the owner of OpenMkt business tenancy.

Self-hosted must support local authentication without requiring an external SaaS identity provider.

Initial authentication targets:

- email/password;
- optional Google sign-in;
- optional GitHub sign-in.

OpenMkt Cloud may later add enterprise OIDC/SAML/SCIM without changing the Workspace domain model.

### 5.2 Workspace domain

Core entities:

```text
users
workspaces
workspace_members
provider_connections
external_accounts
mcp_clients / oauth grants
api_keys
audit_events
```

Initial workspace roles:

- `owner`
- `admin`
- `member`
- `viewer`

Do not implement configurable RBAC in v1.

### 5.3 Workspace membership

Conceptual model:

```ts
WorkspaceMember {
  workspaceId
  userId
  role
}
```

Authorization must always resolve the acting principal against the target workspace before accessing a resource.

## 6. Provider connections and credentials

A `ProviderConnection` is an authorization granted to a Workspace. It is not the same thing as an ad account or analytics property.

Conceptual model:

```ts
ProviderConnection {
  id
  workspaceId
  provider
  authType
  status
  displayName
  encryptedCredentials
  scopes
  expiresAt
  connectedByUserId
  createdAt
  updatedAt
}
```

Potential statuses:

- `active`
- `expired`
- `revoked`
- `error`

Credentials must never be returned through normal REST or MCP responses.

### 6.1 Credential storage abstraction

The domain should depend on a credential store abstraction, for example:

```ts
credentials.get(connectionId)
credentials.put(connectionId, value)
```

OSS implementation may use application-level authenticated encryption backed by an `OPENMKT_ENCRYPTION_KEY`, initially AES-256-GCM.

OpenMkt Cloud may replace this with a KMS/secrets-manager-backed implementation without changing provider or domain code.

### 6.2 Identity OAuth is separate from provider OAuth

Logging in with Google does not implicitly authorize Google Ads, GA4, or GTM.

Provider connection uses an explicit marketing OAuth consent flow with only the scopes required by the capabilities being enabled.

Provider tokens belong to the Workspace connection, not to the user who initiated the connection. The initiating user is retained for audit.

## 7. External accounts

Resources discovered through a ProviderConnection are stored/referenced as `ExternalAccount` records.

Conceptual model:

```ts
ExternalAccount {
  id
  workspaceId
  connectionId
  provider
  externalId
  name
  type
  parentExternalId?
  currency?
  timezone?
  metadata
}
```

Initial account/resource types may include:

- `manager_account`
- `ads_account`
- `analytics_property`
- `tag_manager_account`
- `tag_manager_container`

Avoid creating provider-specific account tables unless a concrete persistence requirement cannot be represented cleanly by the common resource plus typed metadata/provider details.

## 8. Provider capability architecture

The core depends on capabilities, not Google-specific classes.

Example capability contracts:

```ts
interface AdsReportingCapability {
  listCampaigns(input): Promise<Campaign[]>
  getCampaignPerformance(input): Promise<CampaignPerformance[]>
  getAdGroupPerformance(input): Promise<AdGroupPerformance[]>
}

interface AdsManagementCapability {
  createCampaign(input)
  updateCampaign(input)
  setCampaignStatus(input)
  createBudget(input)
  updateBudget(input)
  updateBidding(input)
  createAdGroup(input)
  updateAdGroup(input)
  createAd(input)
  updateAd(input)
  createAsset(input)
  attachAsset(input)
  updateTargeting(input)
}

interface SearchAdsCapability {
  getSearchTerms(input): Promise<SearchTermPerformance[]>
  listKeywords(input): Promise<Keyword[]>
}

interface ConversionCapability {
  listConversionActions(input): Promise<ConversionDefinition[]>
}

interface AudienceCapability {
  listAudiences(input): Promise<Audience[]>
}

interface AnalyticsReportingCapability {
  getOverview(input): Promise<AnalyticsOverview>
  getTrafficSources(input): Promise<TrafficSourcePerformance[]>
  getLandingPages(input): Promise<LandingPagePerformance[]>
  getEvents(input): Promise<EventPerformance[]>
}

interface TagManagementCapability {
  listContainers(input)
  listTags(input)
  listTriggers(input)
  listVariables(input)
}
```

Write capabilities should be narrow and semantic, not generic raw mutation endpoints.

Providers declare supported capabilities and, where useful, capability maturity such as `stable`, `beta`, or `alpha`.

### 8.1 Initial Google capabilities

Google Ads:

- account discovery;
- campaigns and budgets;
- campaign performance;
- bidding configuration required by supported campaign flows;
- ad groups;
- ads/creatives and assets required by supported campaign flows;
- targeting required by supported campaign flows;
- search terms;
- keywords and negative keywords;
- conversion actions;
- audiences/segments;
- controlled writes for those domains through the change engine.

Google Analytics 4:

- property discovery;
- overview;
- traffic sources;
- landing pages;
- events;
- key events;
- supported audience/configuration operations.

Google Tag Manager:

- accounts/containers/workspaces;
- tags;
- triggers;
- variables;
- versions;
- publish workflow.

## 9. Canonical data models

Canonical models stay intentionally small.

Example campaign:

```ts
type Campaign = {
  id: string
  externalId: string
  provider: ProviderId
  accountId: string
  name: string
  status: "active" | "paused" | "removed" | "unknown"
  objective?: string
}
```

Provider-specific information is retained separately:

```ts
providerDetails: {
  googleAds?: {
    advertisingChannelType?: string
    biddingStrategyType?: string
    campaignBudgetId?: string
  }
}
```

Do not add fields to the canonical model simply because one provider exposes them.

## 10. Metrics, money, dates, and timezones

Canonical metrics where semantically equivalent:

- impressions
- clicks
- spend
- conversions
- conversion value

Derived metrics should be calculated consistently by OpenMkt when source data supports it:

- CTR
- CPC
- CPM
- CPA
- ROAS
- conversion rate

Money uses integer micros internally when practical:

```ts
Money {
  amountMicros: bigint
  currency: string
}
```

Public contracts may render decimal monetary strings for interoperability.

Date ranges use calendar dates rather than accidental server-local timestamps. External account timezone must be explicit when provider reporting semantics depend on it.

## 11. MCP architecture

MCP is a first-class interface over OpenMkt Core.

The initial server exposes Streamable HTTP from `apps/server`, while MCP registrations and contracts live in `packages/mcp`.

The MCP layer may expose:

- tools for actions/queries;
- resources for relatively stable context;
- curated prompts/workflows when valuable.

It must not contain provider business logic.

### 11.1 Initial read tools

Indicative surface:

```text
openmkt.get_workspace
openmkt.list_connections
openmkt.list_accounts

openmkt.list_campaigns
openmkt.get_campaign_performance
openmkt.get_search_terms
openmkt.list_conversion_actions
openmkt.list_audiences

openmkt.get_analytics_overview
openmkt.get_traffic_sources
openmkt.get_landing_pages
openmkt.get_events

openmkt.compare_accounts
```

Tool names represent user/business intent. Avoid making the primary surface `google_ads.*` unless an operation is inherently Google-specific and cannot be expressed safely as a cross-provider capability.

### 11.2 Resources

Examples:

```text
openmkt://workspace/current
openmkt://connections
openmkt://accounts
```

### 11.3 No unrestricted query/mutate tool in v1

Do not expose unrestricted GAQL, arbitrary REST paths, or arbitrary provider mutation payloads in the default Cloud product.

A future developer/self-hosted escape hatch may be considered separately with explicit security boundaries.

## 12. MCP/client authorization

Human MCP clients should use OAuth rather than long-lived manually copied API keys.

A grant is workspace-scoped. The client should not need to provide a `workspaceId` argument on every tool invocation.

Conceptual authorization context:

```ts
type RequestPrincipal =
  | {
      type: "user"
      userId: string
      workspaceId: string
      role: WorkspaceRole
    }
  | {
      type: "mcp"
      userId: string
      clientId: string
      workspaceId: string
      scopes: string[]
    }
  | {
      type: "api_key"
      apiKeyId: string
      workspaceId: string
      scopes: string[]
    }
```

Initial broad scopes may include:

- `marketing:read`
- later `marketing:write`
- later narrower high-risk write scopes when justified

Do not create dozens of fine-grained scopes before real consumers require them.

## 13. API keys

API keys support machine-to-machine usage such as scripts, CI, n8n, or custom systems.

Keys are workspace-scoped and stored only as hashes after creation.

Suggested prefix:

```text
omk_...
```

Metadata may include:

- name;
- hashed secret;
- scopes;
- creation date;
- optional expiry;
- last-used timestamp.

Do not create a separate ServiceAccount domain until a concrete use case requires richer machine identity semantics.

## 14. Change Engine

`packages/change-engine` owns write orchestration across providers.

Core lifecycle:

```text
Intent
  -> build plan
  -> read current remote state
  -> validate prerequisites and permissions
  -> calculate diff
  -> classify risk
  -> request/verify confirmation when required
  -> execute
  -> verify resulting remote state
  -> persist audit result
```

The change engine prevents MCP, REST, and Web from each implementing their own unsafe mutation behavior.

### 14.1 Risk levels

Initial model:

- `READ`
- `LOW_WRITE`
- `MEDIUM_WRITE`
- `HIGH_WRITE`

Examples:

`LOW_WRITE`
- rename a resource;
- create an unpublished draft where the provider supports it.

`MEDIUM_WRITE`
- create a tag;
- add a keyword;
- alter targeting.

`HIGH_WRITE`
- publish GTM;
- activate a campaign;
- materially change budget;
- materially change bidding strategy;
- remove/delete conversion configuration.

Risk affects confirmation, permission checks, audit detail, and client UX.

### 14.2 Campaign creation safety

New campaigns should default to a non-serving/paused state when the provider supports it.

Activation requires explicit user intent or a separately confirmed plan.

A campaign change plan may include a provider-specific graph of dependent resources such as budget, campaign, bidding settings, ad groups, ads/creatives, assets, keywords, targeting, audiences, and conversion-goal associations. The user confirms the resulting plan rather than a sequence of opaque raw API calls.

### 14.3 Write examples

Indicative semantic operations:

```text
ads.create_budget
ads.update_budget
ads.create_campaign
ads.update_campaign
ads.pause_campaign
ads.resume_campaign
ads.update_bidding
ads.update_targeting

ads.create_ad_group
ads.update_ad_group
ads.create_ad
ads.update_ad
ads.create_asset
ads.attach_asset

ads.create_keyword
ads.update_keyword
ads.add_negative_keyword

ads.create_audience
ads.update_audience
ads.create_segment
ads.update_segment
ads.attach_audience
ads.exclude_audience

conversions.create_action
conversions.update_action
conversions.set_primary
conversions.set_secondary

goals.update_account_goal
goals.update_campaign_goal

tags.create_tag
tags.update_tag
tags.create_trigger
tags.update_trigger
tags.create_variable
tags.update_variable
tags.create_version
tags.publish_version

analytics.create_key_event
analytics.update_key_event
```

Provider adapters may expose provider-specific subtypes where concepts are not equivalent across platforms.

## 15. Audit model

Sensitive operations must be auditable from v1.

Conceptual model:

```ts
AuditEvent {
  id
  workspaceId
  actorType
  actorId
  action
  resourceType
  resourceId?
  metadata
  createdAt
}
```

Actor types may include:

- `user`
- `mcp_client`
- `api_key`
- `system`

Audit should prioritize security-relevant access and writes. Avoid generating an unbounded event for every row returned by high-volume reporting queries.

Write audit records should retain safe before/after summaries, change-plan identity, provider request/result identifiers where useful, and verification outcome without storing secrets.

## 16. Errors and provider isolation

Provider adapters translate external failures into stable OpenMkt errors such as:

- `PROVIDER_AUTH_EXPIRED`
- `PROVIDER_PERMISSION_DENIED`
- `PROVIDER_RATE_LIMITED`
- `PROVIDER_ACCOUNT_NOT_FOUND`
- `PROVIDER_TEMPORARILY_UNAVAILABLE`

Error payloads may include provider and retryability but must never include tokens, private keys, or unsafe upstream request dumps.

## 17. Pagination and rate limiting

List operations use cursor-based pagination at the OpenMkt boundary even when the provider internally uses different pagination semantics.

Initial collection defaults may be around 50 items with server-defined upper bounds; exact values are configuration/implementation details rather than architectural guarantees.

Rate limiting needs at least these dimensions:

- Workspace;
- ProviderConnection;
- underlying provider quotas.

## 18. Web application

The initial Web application covers:

- authentication;
- workspace selection/management;
- member management appropriate to v1 roles;
- provider connection flows;
- external account discovery/selection;
- read views for campaigns, analytics, conversions, audiences, and tags;
- controlled write flows as they are added to the change engine;
- change-plan preview/confirmation;
- audit visibility.

The Web app calls the same server/application layer used by MCP.

### 18.1 Future: user-provided LLM API connections

Not part of the initial MVP, but the architecture must leave room for users to connect LLM providers directly in the Web application using their own API credentials.

Possible future providers include OpenAI and other supported LLM APIs.

This feature would allow a user to analyze, plan, create, and modify campaigns from the OpenMkt Web portal using a conversational/agent experience without requiring an external MCP host such as ChatGPT or Claude.

Design constraints for that future capability:

- LLM credentials are workspace-scoped secrets;
- credentials use the same secure credential-store abstraction principles as marketing provider credentials;
- LLM agents call OpenMkt Core/change-engine operations, never provider APIs directly;
- write operations still use normal OpenMkt risk classification, plan/diff/confirmation, verification, and audit;
- provider-specific agent implementation must not bypass workspace authorization;
- adding this capability must not make an external LLM API mandatory for OSS users.

A future structure may add an `llm-providers` package family or equivalent only when implementation begins.

## 19. ChatGPT Plugin

OpenMkt should later ship an official ChatGPT plugin built on the existing OpenMkt MCP server.

The plugin is an integration layer, not a separate marketing backend.

Potential plugin capabilities:

- reusable campaign-audit skills;
- analytics investigation skills;
- account comparison workflows;
- campaign creation/editing workflows;
- audience/segment workflows;
- conversion/tag/goal setup workflows;
- interactive MCP Apps for campaign creation preview;
- audience builder;
- conversion setup review;
- GTM change review and publish confirmation.

The same OpenMkt MCP remains usable by other MCP clients without the plugin.

## 20. OSS vs Cloud

### 20.1 OpenMkt OSS

The OSS edition should include the real product core:

- users/auth;
- workspaces;
- provider connections;
- Google Ads integration;
- GA4 integration;
- GTM integration;
- MCP;
- REST API;
- Web dashboard;
- read operations;
- write operations as implemented;
- change engine;
- audit log;
- Docker-based self-hosting.

Do not intentionally cripple the OSS edition to force Cloud adoption.

### 20.2 OpenMkt Cloud

Cloud differentiates through managed operation:

- zero-setup hosting;
- managed PostgreSQL;
- managed encryption/KMS;
- backups;
- automatic upgrades;
- hosted OAuth applications;
- monitoring;
- rate-limit/quota management;
- managed scheduled workloads;
- audit retention;
- support;
- later enterprise identity/compliance features.

Potential plan families, without pricing/limits fixed at architecture stage:

- Free
- Pro
- Agency
- Enterprise

Agency is a first-class future commercial use case because the Workspace model naturally supports client separation.

Billing and subscription tables are Cloud concerns and should not pollute the OSS core before the Cloud implementation needs them.

## 21. Licensing

Use AGPL-3.0 for the OpenMkt core and first-party server/Web/provider implementation.

Client SDKs may be evaluated separately for a more permissive license such as Apache-2.0 if that improves third-party adoption. Do not introduce dual licensing until a concrete commercial requirement exists.

## 22. Security requirements

- Never expose provider refresh/access tokens to clients.
- Never expose encryption keys or LLM API keys.
- Never log secrets.
- Every domain lookup for workspace-owned resources verifies workspace ownership.
- Provider OAuth scopes should follow least privilege compatible with enabled capabilities.
- MCP grants are workspace-scoped.
- API keys are workspace-scoped and hashed after issuance.
- Writes use explicit semantic operations.
- High-risk changes require explicit confirmation.
- Provider response/request payload logging must be sanitized.
- Web and MCP do not get direct database access.
- Provider adapters do not authorize users; authorization occurs before adapter invocation.

## 23. Testing strategy

### Unit

- workspace authorization;
- provider capability mapping;
- metric derivation;
- money/date handling;
- credential envelope handling;
- error normalization;
- change-plan diff/risk classification;
- campaign dependency-plan construction;
- idempotency where applicable;
- MCP schemas/tool registration.

### Provider adapter

- mock upstream HTTP APIs;
- request construction;
- pagination;
- account discovery;
- response mapping;
- error redaction;
- mutation validation;
- dependent-resource mutation ordering;
- verification after write.

### Integration

- PostgreSQL persistence;
- auth/session behavior;
- workspace isolation;
- encrypted provider connection lifecycle;
- OAuth/MCP grant scoping;
- API-key scoping;
- audit writes.

### MCP

- initialize/list tools;
- resource listing;
- valid read tool call;
- invalid input;
- unauthenticated request;
- wrong workspace isolation;
- write-plan creation;
- confirmation enforcement;
- sanitized upstream failure.

### End-to-end Web

Add E2E coverage as interactive provider connection and change-confirmation flows mature.

## 24. Delivery milestones

### M0 — Foundation

- monorepo scaffold;
- AGPL license;
- server + Web applications;
- PostgreSQL/Drizzle;
- Workspace/User/Membership;
- auth;
- Docker local environment;
- base audit infrastructure.

### M1 — Google read

- Google provider OAuth;
- secure credential storage;
- Google Ads account discovery/read;
- GA4 property discovery/read;
- GTM account/container discovery/read;
- MCP read tools;
- corresponding REST/Web views.

### M2 — Change Engine

- semantic change plans;
- diffs;
- risk classification;
- confirmation model;
- execution boundary;
- verification;
- audit trail;
- idempotency strategy.

### M3 — Google write

- campaign budgets and supported bidding configuration;
- campaign create/edit/pause/resume;
- ad groups;
- ads/creatives and assets required by supported campaign flows;
- targeting required by supported campaign flows;
- keyword and negative-keyword operations;
- audience/segment operations supported by Google APIs;
- conversion actions;
- conversion goals;
- GA4 key-event/config operations selected for stable support;
- GTM tag/trigger/variable management;
- GTM version creation and controlled publication.

### M4 — OpenMkt Cloud

- production managed deployment;
- managed OAuth clients;
- managed secrets/KMS;
- billing/quotas;
- backups/monitoring;
- managed updates;
- Cloud plan enforcement outside the OSS domain.

### M5 — ChatGPT Plugin

- connect official plugin to existing OpenMkt MCP;
- skills/workflows;
- interactive write previews/confirmation surfaces where useful;
- campaign/audience/conversion/tag/goal workflows;
- prepare for public plugin distribution when the product is ready.

### Later

- Meta Ads;
- TikTok Ads;
- Microsoft Ads;
- Search Console;
- Merchant Center;
- additional providers;
- user-provided LLM API connections in the Web portal;
- scheduled/background marketing automations;
- richer agency and enterprise capabilities.

## 25. Explicit non-goals for the first implementation cycle

- microservice decomposition;
- arbitrary provider query consoles exposed to agents;
- arbitrary provider mutation payloads;
- generic configurable RBAC;
- custom workflow engine;
- data warehouse;
- billing implementation before Cloud milestone;
- LLM-provider connections inside the Web MVP;
- Meta/TikTok implementation before Google architecture is validated;
- enterprise SSO in the OSS foundation milestone.

## 26. Acceptance criteria for the architecture foundation

The foundation implementation following this design should make it possible to prove all of the following without architectural rewrites:

1. A user can self-host OpenMkt with PostgreSQL and Docker-compatible infrastructure.
2. A user can authenticate without depending on a proprietary auth SaaS.
3. A user can belong to one or more Workspaces.
4. Workspace-owned data cannot be read across workspace boundaries through normal application paths.
5. A Workspace can hold a provider connection whose credentials are encrypted at rest.
6. MCP can authenticate a client into one Workspace context.
7. The same application service can be called from REST and MCP.
8. A provider package can implement capabilities without placing provider-specific HTTP logic in the core.
9. A semantic write can be represented as a change plan with diff, risk, confirmation requirement, verification, and audit lifecycle.
10. A complete campaign creation flow can be represented as one user-facing change plan even when the provider requires multiple dependent resources.
11. The architecture can add Meta/TikTok providers without changing the Workspace/auth/core tenancy model.
12. The Web application can later add an LLM-agent layer without bypassing the existing authorization/change-engine boundaries.

## 27. Design decisions summary

Approved decisions:

1. OpenMkt is independent from Itscred.
2. OpenMkt core is AGPL-3.0.
3. OSS is portable and vendor-neutral: Node/TypeScript + PostgreSQL + Docker.
4. OpenMkt Cloud uses the same product core.
5. Workspace is the explicit tenancy/isolation boundary.
6. OSS authentication works without a mandatory external auth SaaS.
7. Better Auth is identity infrastructure, not the Workspace domain.
8. Hono server + React/Vite Web + Drizzle/PostgreSQL + pnpm/Turbo.
9. Provider integration is capability-based.
10. Google Ads + GA4 + GTM are the first provider integrations.
11. MCP is a first-class interface over OpenMkt Core, not the domain itself.
12. Provider connection OAuth is separate from user sign-in OAuth.
13. MCP grants and API keys are workspace-scoped.
14. OpenMkt is a control plane capable of reads and controlled writes.
15. Campaign creation includes its required dependent resources through provider-specific change plans.
16. Writes flow through Plan -> Diff -> Confirm -> Execute -> Verify -> Audit.
17. New campaigns default to paused/non-serving where supported unless explicit activation is approved.
18. Default Cloud/MCP surfaces do not expose unrestricted query/mutate primitives.
19. OSS remains fully useful; Cloud monetizes managed operation.
20. The ChatGPT plugin will use the existing OpenMkt MCP server.
21. The Web may later support user-provided LLM API connections for in-portal agent workflows, but this is outside the initial MVP.
