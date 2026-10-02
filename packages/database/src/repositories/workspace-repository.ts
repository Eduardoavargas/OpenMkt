import type {
  Workspace,
  WorkspaceMembershipView,
  WorkspaceRepository,
  WorkspaceSummary,
} from '@openmkt/core'
import { and, eq } from 'drizzle-orm'
import type { OpenMktDatabase } from '../client.js'
import { workspaceMembers, workspaces } from '../schema/openmkt.js'

export class DrizzleWorkspaceRepository implements WorkspaceRepository {
  constructor(private readonly db: OpenMktDatabase) {}

  async createWithOwner(input: {
    workspace: Workspace
    ownerUserId: string
  }): Promise<Workspace> {
    return this.db.transaction(async (tx) => {
      await tx.insert(workspaces).values(input.workspace)
      await tx.insert(workspaceMembers).values({
        workspaceId: input.workspace.id,
        userId: input.ownerUserId,
        role: 'owner',
      })
      return input.workspace
    })
  }

  async listForUser(userId: string): Promise<WorkspaceSummary[]> {
    return this.db
      .select({
        id: workspaces.id,
        name: workspaces.name,
        slug: workspaces.slug,
        role: workspaceMembers.role,
      })
      .from(workspaceMembers)
      .innerJoin(workspaces, eq(workspaces.id, workspaceMembers.workspaceId))
      .where(eq(workspaceMembers.userId, userId))
  }

  async findMembership(input: {
    workspaceId: string
    userId: string
  }): Promise<WorkspaceMembershipView | null> {
    const [row] = await this.db
      .select({
        id: workspaces.id,
        name: workspaces.name,
        slug: workspaces.slug,
        role: workspaceMembers.role,
      })
      .from(workspaceMembers)
      .innerJoin(workspaces, eq(workspaces.id, workspaceMembers.workspaceId))
      .where(
        and(
          eq(workspaceMembers.workspaceId, input.workspaceId),
          eq(workspaceMembers.userId, input.userId),
        ),
      )
      .limit(1)

    if (!row) return null

    return {
      workspace: {
        id: row.id,
        name: row.name,
        slug: row.slug,
      },
      role: row.role,
    }
  }
}

export function createWorkspaceRepository(
  db: OpenMktDatabase,
): WorkspaceRepository {
  return new DrizzleWorkspaceRepository(db)
}
