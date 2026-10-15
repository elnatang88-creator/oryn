/** Errors carry a user-safe message. Internal detail never reaches the client. */
export class AppError extends Error {
  constructor(public code: 'not_found' | 'forbidden' | 'invalid' | 'plan' | 'rate_limited' | 'unauthenticated' | 'conflict', message: string, public detail?: Record<string, unknown>) {
    super(message)
  }
}
export const notFound = (what = 'That item') => new AppError('not_found', `${what} could not be found.`)
export const invalid = (message: string) => new AppError('invalid', message)
export class PlanGateError extends AppError {
  constructor(public capability: string, message: string) {
    super('plan', message, { capability })
  }
}
