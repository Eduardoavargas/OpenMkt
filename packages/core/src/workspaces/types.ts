export type WorkspaceRole = 'owner' | 'admin' | 'member' | 'viewer'

export type UserPrincipal = {
  type: 'user'
  userId: string
}

export interface Workspace {
  id: string
  name: string
  slug: string
}

export interface WorkspaceSummary extends Workspace {
  role: WorkspaceRole
}

export interface WorkspaceMembershipView {
  workspace: Workspace
  role: WorkspaceRole
}

export interface WorkspaceRepository {
  createWithOwner(input: {
    workspace: Workspace
    ownerUserId: string
  }): Promise<Workspace>

  listForUser(userId: string): Promise<WorkspaceSummary[]>

  findMembership(input: {
    workspaceId: string
    userId: string
  }): Promise<WorkspaceMembershipView | null>
}
