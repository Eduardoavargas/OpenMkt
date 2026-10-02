import { randomUUID } from 'node:crypto'
import { InvalidWorkspaceError, WorkspaceNotFoundError } from './errors.js'
import type {
  UserPrincipal,
  Workspace,
  WorkspaceMembershipView,
  WorkspaceRepository,
  WorkspaceSummary,
} from './types.js'

const normalizedSlug = /^[a-z0-9]+(?:-[a-z0-9]+)*$/

export class WorkspaceService {
  constructor(private readonly repository: WorkspaceRepository) {}

  async createWorkspace(input: {
    principal: UserPrincipal
    name: string
    slug: string
  }): Promise<Workspace> {
    const name = input.name.trim()

    if (!name) {
      throw new InvalidWorkspaceError('Workspace name is required')
    }

    if (!normalizedSlug.test(input.slug)) {
      throw new InvalidWorkspaceError('Workspace slug must be normalized')
    }

    return this.repository.createWithOwner({
      workspace: {
        id: randomUUID(),
        name,
        slug: input.slug,
      },
      ownerUserId: input.principal.userId,
    })
  }

  listWorkspaces(principal: UserPrincipal): Promise<WorkspaceSummary[]> {
    return this.repository.listForUser(principal.userId)
  }

  async requireMembership(input: {
    principal: UserPrincipal
    workspaceId: string
  }): Promise<WorkspaceMembershipView> {
    const membership = await this.repository.findMembership({
      workspaceId: input.workspaceId,
      userId: input.principal.userId,
    })

    if (!membership) {
      throw new WorkspaceNotFoundError()
    }

    return membership
  }
}
