export class WorkspaceNotFoundError extends Error {
  readonly code = 'WORKSPACE_NOT_FOUND'

  constructor() {
    super('Workspace not found')
    this.name = 'WorkspaceNotFoundError'
  }
}

export class InvalidWorkspaceError extends Error {
  readonly code = 'INVALID_WORKSPACE'

  constructor(message: string) {
    super(message)
    this.name = 'InvalidWorkspaceError'
  }
}
