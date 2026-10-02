import { randomUUID } from 'node:crypto'
import { afterAll, describe, expect, it } from 'vitest'
import { Pool } from 'pg'

const databaseUrl = process.env.TEST_DATABASE_URL

if (!databaseUrl) {
  throw new Error('TEST_DATABASE_URL is required')
}

const pool = new Pool({ connectionString: databaseUrl })

afterAll(async () => {
  await pool.end()
})

describe('OpenMkt tenancy schema', () => {
  it('creates an owner membership and rejects a duplicate membership', async () => {
    const userId = randomUUID()
    const workspaceId = randomUUID()
    const email = `owner-${randomUUID()}@example.test`

    await pool.query(
      'insert into auth."user" (id, name, email, email_verified, created_at, updated_at) values ($1, $2, $3, false, now(), now())',
      [userId, 'Workspace owner', email],
    )
    await pool.query(
      'insert into workspaces (id, name, slug, created_at, updated_at) values ($1, $2, $3, now(), now())',
      [workspaceId, 'Owned workspace', `owned-${randomUUID()}`],
    )
    await pool.query(
      'insert into workspace_members (workspace_id, user_id, role, created_at) values ($1, $2, $3, now())',
      [workspaceId, userId, 'owner'],
    )

    const membership = await pool.query(
      'select workspace_id, user_id, role from workspace_members where workspace_id = $1 and user_id = $2',
      [workspaceId, userId],
    )

    expect(membership.rows).toEqual([
      {
        workspace_id: workspaceId,
        user_id: userId,
        role: 'owner',
      },
    ])

    await expect(
      pool.query(
        'insert into workspace_members (workspace_id, user_id, role, created_at) values ($1, $2, $3, now())',
        [workspaceId, userId, 'viewer'],
      ),
    ).rejects.toMatchObject({ code: '23505' })
  })

  it('enforces unique workspace slugs', async () => {
    const firstId = randomUUID()
    const secondId = randomUUID()
    const slug = `workspace-${randomUUID()}`

    await pool.query(
      'insert into workspaces (id, name, slug, created_at, updated_at) values ($1, $2, $3, now(), now())',
      [firstId, 'First workspace', slug],
    )

    await expect(
      pool.query(
        'insert into workspaces (id, name, slug, created_at, updated_at) values ($1, $2, $3, now(), now())',
        [secondId, 'Second workspace', slug],
      ),
    ).rejects.toMatchObject({ code: '23505' })
  })
})
