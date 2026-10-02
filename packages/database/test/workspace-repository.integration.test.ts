import { randomUUID } from 'node:crypto'
import { eq } from 'drizzle-orm'
import { drizzle } from 'drizzle-orm/node-postgres'
import { Pool } from 'pg'
import { afterAll, describe, expect, it } from 'vitest'
import { DrizzleWorkspaceRepository } from '../src/repositories/workspace-repository.js'
import * as schema from '../src/schema/index.js'
import { user } from '../src/schema/auth.js'
import { workspaceMembers, workspaces } from '../src/schema/openmkt.js'

const databaseUrl = process.env.TEST_DATABASE_URL

if (!databaseUrl) {
  throw new Error('TEST_DATABASE_URL is required')
}

const pool = new Pool({ connectionString: databaseUrl })
const db = drizzle({ client: pool, schema })
const repository = new DrizzleWorkspaceRepository(db)
const suffix = randomUUID()
const userAId = randomUUID()
const userBId = randomUUID()

await db.insert(user).values([
  {
    id: userAId,
    name: 'User A',
    email: `user-a-${suffix}@example.com`,
    emailVerified: true,
  },
  {
    id: userBId,
    name: 'User B',
    email: `user-b-${suffix}@example.com`,
    emailVerified: true,
  },
])

afterAll(async () => {
  await pool.end()
})

describe('DrizzleWorkspaceRepository', () => {
  it('creates workspace and owner membership atomically', async () => {
    const workspace = {
      id: randomUUID(),
      name: 'Workspace A',
      slug: `workspace-a-${suffix}`,
    }

    await expect(
      repository.createWithOwner({ workspace, ownerUserId: randomUUID() }),
    ).rejects.toBeDefined()

    const rows = await db
      .select({ id: workspaces.id })
      .from(workspaces)
      .where(eq(workspaces.id, workspace.id))

    expect(rows).toHaveLength(0)
  })

  it('isolates memberships and stores the owner role', async () => {
    const workspaceA = {
      id: randomUUID(),
      name: 'Workspace A',
      slug: `workspace-a-ok-${suffix}`,
    }
    const workspaceB = {
      id: randomUUID(),
      name: 'Workspace B',
      slug: `workspace-b-${suffix}`,
    }

    await repository.createWithOwner({ workspace: workspaceA, ownerUserId: userAId })
    await repository.createWithOwner({ workspace: workspaceB, ownerUserId: userBId })

    await expect(
      repository.findMembership({ workspaceId: workspaceB.id, userId: userAId }),
    ).resolves.toBeNull()

    await expect(
      repository.findMembership({ workspaceId: workspaceB.id, userId: userBId }),
    ).resolves.toMatchObject({
      workspace: workspaceB,
      role: 'owner',
    })

    await expect(repository.listForUser(userAId)).resolves.toEqual([
      { ...workspaceA, role: 'owner' },
    ])
  })

  it('rejects duplicate memberships at the database boundary', async () => {
    const workspace = {
      id: randomUUID(),
      name: 'Duplicate membership workspace',
      slug: `duplicate-membership-${suffix}`,
    }

    await repository.createWithOwner({ workspace, ownerUserId: userAId })

    await expect(
      db.insert(workspaceMembers).values({
        workspaceId: workspace.id,
        userId: userAId,
        role: 'owner',
      }),
    ).rejects.toBeDefined()
  })
})
