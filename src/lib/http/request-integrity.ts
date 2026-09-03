import { randomUUID } from 'node:crypto'
import { ZodError } from 'zod'
import { isAccessError } from '@/lib/auth/access-error'

const correlationIdPattern = /^[A-Za-z0-9._:-]{1,128}$/
const maxJsonBodyBytes = 16 * 1024

export class RequestIntegrityError extends Error {
  readonly status: 400 | 403 | 413 | 415 | 500

  constructor(status: RequestIntegrityError['status'], message: string) {
    super(message)
    this.name = 'RequestIntegrityError'
    this.status = status
  }
}

const requireConfiguredOrigin = (configuredUrl: string | undefined) => {
  if (!configuredUrl) {
    throw new RequestIntegrityError(500, 'Application origin is not configured')
  }
  let url: URL
  try {
    url = new URL(configuredUrl)
  } catch {
    throw new RequestIntegrityError(500, 'Application origin is invalid')
  }
  if (
    !['http:', 'https:'].includes(url.protocol) ||
    url.username ||
    url.password ||
    url.search ||
    url.hash ||
    (url.pathname !== '/' && url.pathname !== '')
  ) {
    throw new RequestIntegrityError(500, 'Application origin is invalid')
  }
  return url.origin
}

export const requireTrustedJsonRequest = (
  request: Request,
  configuredUrl = process.env.NEXT_PUBLIC_URL
) => {
  const contentType = request.headers.get('content-type')
  if (contentType?.split(';', 1)[0].trim().toLowerCase() !== 'application/json') {
    throw new RequestIntegrityError(415, 'Expected application/json')
  }

  const contentLength = request.headers.get('content-length')
  if (contentLength) {
    const bytes = Number(contentLength)
    if (!Number.isSafeInteger(bytes) || bytes < 0) {
      throw new RequestIntegrityError(400, 'Invalid content length')
    }
    if (bytes > maxJsonBodyBytes) {
      throw new RequestIntegrityError(413, 'Request body is too large')
    }
  }

  const fetchSite = request.headers.get('sec-fetch-site')
  if (fetchSite && fetchSite !== 'same-origin') {
    throw new RequestIntegrityError(403, 'Request origin is not allowed')
  }

  const origin = request.headers.get('origin')
  if (!origin || origin === 'null') {
    throw new RequestIntegrityError(403, 'Request origin is not allowed')
  }
  let requestOrigin: URL
  try {
    requestOrigin = new URL(origin)
  } catch {
    throw new RequestIntegrityError(403, 'Request origin is not allowed')
  }
  if (
    !['http:', 'https:'].includes(requestOrigin.protocol) ||
    requestOrigin.username ||
    requestOrigin.password ||
    requestOrigin.search ||
    requestOrigin.hash ||
    (requestOrigin.pathname !== '/' && requestOrigin.pathname !== '') ||
    requestOrigin.origin !== requireConfiguredOrigin(configuredUrl)
  ) {
    throw new RequestIntegrityError(403, 'Request origin is not allowed')
  }
}

export const readTrustedJsonRequest = async (
  request: Request,
  configuredUrl = process.env.NEXT_PUBLIC_URL
) => {
  requireTrustedJsonRequest(request, configuredUrl)
  const reader = request.body?.getReader()
  const chunks: Uint8Array[] = []
  let totalBytes = 0

  if (reader) {
    try {
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        totalBytes += value.byteLength
        if (totalBytes > maxJsonBodyBytes) {
          await reader.cancel().catch(() => undefined)
          throw new RequestIntegrityError(413, 'Request body is too large')
        }
        chunks.push(value)
      }
    } finally {
      reader.releaseLock()
    }
  }

  const body = new Uint8Array(totalBytes)
  let offset = 0
  for (const chunk of chunks) {
    body.set(chunk, offset)
    offset += chunk.byteLength
  }

  try {
    return JSON.parse(
      new TextDecoder('utf-8', { fatal: true }).decode(body)
    ) as unknown
  } catch {
    throw new SyntaxError('Invalid JSON')
  }
}

export const getRequestCorrelationId = (request: Request) => {
  const candidate = request.headers.get('x-correlation-id')
  return candidate && correlationIdPattern.test(candidate)
    ? candidate
    : randomUUID()
}

export const safeHttpError = (error: unknown) => {
  if (error instanceof RequestIntegrityError) {
    return { message: error.message, status: error.status }
  }
  if (error instanceof ZodError || error instanceof SyntaxError) {
    return { message: 'Invalid request', status: 400 as const }
  }
  if (isAccessError(error)) {
    return { message: error.message, status: error.status }
  }
  return { message: 'Service unavailable', status: 502 as const }
}
