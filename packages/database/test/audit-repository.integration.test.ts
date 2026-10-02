import { randomUUID } from 'node:crypto'
import { drizzle } from 'drizzle-orm/node-postgres'
import { Pool } from 'pg'
import { afterAll, describe, expect, it } from 'vitest'
import { DrizzleAuditRepository } from '../src/repositories/audit-repository.js'
import * as schema from '../src/schema/index.js'
import { workspaces } from '../src/schema/openmkt.js'

const databaseUrl = process.env.TEST_DATABASE_URL

if (!databaseUrl) {
  throw new Error('TEST_DATABASE_URL is required')
}

const pool = new Pool({ connectionString: databaseUrl })
const db = drizzle({ client: pool, schema })
const repository = new DrizzleAuditRepository(db)
const suffix = randomUUID()
const workspaceAId = randomUUID()
const workspaceBId = randomUUID()

await db.insert(workspaces).values([
  {
    id: workspaceAId,
    name: 'Audit Workspace A',
    slug: `audit-workspace-a-${suffix}`,
  },
  {
    id: workspaceBId,
    name: 'Audit Workspace B',
    slug: `audit-workspace-b-${suffix}`,
  },
])

afterAll(async () => {
  await pool.end()
})

describe('DrizzleAuditRepository', () => {
  it('persists structured metadata and scopes reads by workspace', async () => {
    await repository.append({
      workspaceId: workspaceAId,
      actor: { type: 'user', id: randomUUID() },
      action: 'workspace.created',
      resourceType: 'workspace',
      resourceId: workspaceAId,
      metadata: { source: 'integration-test' },
    })
    await repository.append({
      workspaceId: workspaceBId,
      actor: { type: 'user', id: randomUUID() },
      action: 'workspace.created',
      resourceType: 'workspace',
      resourceId: workspaceBId,
      metadata: { source: 'other-workspace' },
    })

    const events = await repository.list({
      workspaceId: workspaceAId,
      limit: 50,
    })

    expect(events).toHaveLength(1)
    expect(events[0]).toMatchObject({
      workspaceId: workspaceAId,
      action: 'workspace.created',
      resourceType: 'workspace',
      resourceId: workspaceAId,
      metadata: { source: 'integration-test' },
      actor: { type: 'user' },
    })
    expect(events[0]?.createdAt).toBeInstanceOf(Date)
  })

  it('respects the requested limit and newest-first ordering', async () => {
    await repository.append({
      workspaceId: workspaceAId,
      actor: { type: 'user', id: randomUUID() },
      action: 'first',
      resourceType: 'test',
    })
    await new Promise((resolve) => setTimeout(resolve, 5))
    await repository.append({
      workspaceId: workspaceAId,
      actor: { type: 'user', id: randomUUID() },
      action: 'second',
      resourceType: 'test',
    })

    const events = await repository.list({
      workspaceId: workspaceAId,
      limit: 1,
    })

    expect(events).toHaveLength(1)
    expect(events[0]?.action).toBe('second')
  })
})
