export type AccessErrorCode =
  | 'UNAUTHENTICATED'
  | 'PROVISIONING_REQUIRED'
  | 'FORBIDDEN'
  | 'RESOURCE_NOT_FOUND'

export class AccessError extends Error {
  readonly code: AccessErrorCode
  readonly status: 401 | 403 | 404

  constructor(code: AccessErrorCode) {
    const details = {
      UNAUTHENTICATED: { message: 'Authentication required', status: 401 },
      PROVISIONING_REQUIRED: {
        message: 'Local account provisioning required',
        status: 403,
      },
      FORBIDDEN: { message: 'Access denied', status: 403 },
      RESOURCE_NOT_FOUND: { message: 'Resource not found', status: 404 },
    } as const

    super(details[code].message)
    this.name = 'AccessError'
    this.code = code
    this.status = details[code].status
  }
}

export const isAccessError = (error: unknown): error is AccessError =>
  error instanceof AccessError
