import { describe, expect, test } from 'bun:test'
import { AccessError } from '../../src/lib/auth/access-error'
import {
  getRequestCorrelationId,
  readTrustedJsonRequest,
  RequestIntegrityError,
  requireTrustedJsonRequest,
  safeHttpError,
} from '../../src/lib/http/request-integrity'

const request = (headers: Record<string, string> = {}) =>
  new Request('https://app.crewframe.test/api/stripe/example', {
    headers: {
      'content-type': 'application/json; charset=utf-8',
      origin: 'https://app.crewframe.test',
      'sec-fetch-site': 'same-origin',
      ...headers,
    },
    method: 'POST',
  })

const expectStatus = (
  operation: () => void,
  status: RequestIntegrityError['status']
) => {
  try {
    operation()
    throw new Error('Expected request to be rejected')
  } catch (error) {
    expect(error).toBeInstanceOf(RequestIntegrityError)
    expect((error as RequestIntegrityError).status).toBe(status)
  }
}

describe('authenticated Stripe request integrity', () => {
  test('accepts only the exact normalized application origin and JSON', () => {
    expect(() =>
      requireTrustedJsonRequest(
        request({ origin: 'https://APP.CREWFRAME.TEST' }),
        'https://app.crewframe.test/'
      )
    ).not.toThrow()
  })

  test.each([
    ['missing origin', { origin: '' }],
    ['null origin', { origin: 'null' }],
    ['wrong scheme', { origin: 'http://app.crewframe.test' }],
    ['wrong port', { origin: 'https://app.crewframe.test:444' }],
    ['prefix domain', { origin: 'https://app.crewframe.test.evil.test' }],
    ['suffix domain', { origin: 'https://evilapp.crewframe.test' }],
    ['origin path', { origin: 'https://app.crewframe.test/path' }],
    ['cross-site fetch', { 'sec-fetch-site': 'cross-site' }],
  ])('rejects %s', (_, headers) => {
    expectStatus(
      () =>
        requireTrustedJsonRequest(request(headers), 'https://app.crewframe.test'),
      403
    )
  })

  test('rejects non-JSON and oversized bodies', () => {
    expectStatus(
      () =>
        requireTrustedJsonRequest(
          request({ 'content-type': 'text/plain' }),
          'https://app.crewframe.test'
        ),
      415
    )
    expectStatus(
      () =>
        requireTrustedJsonRequest(
          request({ 'content-length': String(16 * 1024 + 1) }),
          'https://app.crewframe.test'
        ),
      413
    )
  })

  test.each([['missing'], ['false']])(
    'cancels an oversized chunked body with %s content length before reading its tail',
    async (contentLength) => {
      let cancelled = false
      let tailRead = false
      const chunks = [
        new Uint8Array(9_000),
        new Uint8Array(9_000),
        new Uint8Array([1]),
      ]
      let index = 0
      const body = new ReadableStream<Uint8Array>({
        cancel: () => {
          cancelled = true
        },
        pull: (controller) => {
          if (index === 2) tailRead = true
          const chunk = chunks[index]
          index += 1
          if (chunk) controller.enqueue(chunk)
          else controller.close()
        },
        type: 'bytes',
      })
      const headers: Record<string, string> = {
        'content-type': 'application/json',
        origin: 'https://app.crewframe.test',
        'sec-fetch-site': 'same-origin',
      }
      if (contentLength === 'false') headers['content-length'] = '10'
      const oversized = new Request(
        'https://app.crewframe.test/api/stripe/example',
        { body, headers, method: 'POST' }
      )

      await expect(
        readTrustedJsonRequest(oversized, 'https://app.crewframe.test')
      ).rejects.toMatchObject({ status: 413 })
      expect(cancelled).toBe(true)
      expect(tailRead).toBe(false)
    }
  )

  test('sanitizes correlation IDs and never returns provider error details', () => {
    const accepted = getRequestCorrelationId(
      request({ 'x-correlation-id': 'request.safe-1' })
    )
    const generated = getRequestCorrelationId(
      request({ 'x-correlation-id': 'bad value' })
    )
    expect(accepted).toBe('request.safe-1')
    expect(generated).toMatch(/^[0-9a-f-]{36}$/)

    expect(
      safeHttpError(
        new Error('provider customer, price, request, and key details')
      )
    ).toEqual({ message: 'Service unavailable', status: 502 })
    expect(safeHttpError(new AccessError('FORBIDDEN'))).toEqual({
      message: 'Access denied',
      status: 403,
    })
  })
})
