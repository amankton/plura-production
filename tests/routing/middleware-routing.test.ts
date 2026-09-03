import { describe, expect, test } from 'bun:test'
import {
  enforcePathProtection,
  isPublicPath,
  PUBLIC_ROUTES,
  resolveRoutingDecision,
} from '../../src/lib/routing/middleware-routing'

const decide = (
  pathname: string,
  options: Partial<{
    host: string | null
    rootDomain: string | undefined
    search: string
  }> = {}
) =>
  resolveRoutingDecision({
    host: 'example.test',
    pathname,
    rootDomain: 'example.test',
    search: '',
    ...options,
  })

describe('middleware route characterization', () => {
  test('keeps only the marketing page and UploadThing transport public', () => {
    expect(PUBLIC_ROUTES).toEqual(['/site', '/api/uploadthing'])
    expect(isPublicPath('/site')).toBeTrue()
    expect(isPublicPath('/api/uploadthing')).toBeTrue()
    for (const protectedPath of [
      '/',
      '/agency/agency-a',
      '/api/stripe/webhook',
      '/api/uploadthing/other',
      '/offer',
      '/subaccount/sub-a',
    ]) {
      expect(isPublicPath(protectedPath)).toBeFalse()
    }
  })

  test('protects every route outside the exact public allowlist', async () => {
    const protectedPaths: string[] = []
    const protect = async (pathname: string) => {
      protectedPaths.push(pathname)
    }

    for (const pathname of ['/site', '/api/uploadthing']) {
      await enforcePathProtection(pathname, () => protect(pathname))
    }
    for (const pathname of [
      '/',
      '/agency/agency-a',
      '/api/stripe/webhook',
      '/api/uploadthing/other',
      '/offer',
      '/subaccount/sub-a',
    ]) {
      await enforcePathProtection(pathname, () => protect(pathname))
    }

    expect(protectedPaths).toEqual([
      '/',
      '/agency/agency-a',
      '/api/stripe/webhook',
      '/api/uploadthing/other',
      '/offer',
      '/subaccount/sub-a',
    ])
  })

  test.each(['/', '/site'])('rewrites %s to the marketing site', (path) => {
    expect(decide(path)).toEqual({ destination: '/site', type: 'rewrite' })
  })

  test.each(['/sign-in', '/sign-up'])(
    'redirects %s to agency sign-in',
    (path) => {
      expect(decide(path)).toEqual({
        destination: '/agency/sign-in',
        type: 'redirect',
      })
    }
  )

  test('preserves path and query for authenticated workspace routes', () => {
    expect(decide('/subaccount/sub-a/contacts', { search: 'page=2' })).toEqual({
      destination: '/subaccount/sub-a/contacts?page=2',
      type: 'rewrite',
    })
    expect(decide('/agency/agency-a')).toEqual({
      destination: '/agency/agency-a',
      type: 'rewrite',
    })
  })

  test('rewrites a recognized custom subdomain and preserves its query', () => {
    expect(
      decide('/offer', {
        host: 'client.example.test',
        search: 'utm_source=test',
      })
    ).toEqual({
      destination: '/client./offer?utm_source=test',
      type: 'rewrite',
    })
  })

  test('does not reinterpret an unknown host as a tenant', () => {
    expect(decide('/offer', { host: 'attacker.invalid' })).toEqual({
      type: 'continue',
    })
    expect(decide('/offer', { host: 'evil-example.test' })).toEqual({
      type: 'continue',
    })
    expect(decide('/offer', { host: 'notexample.test' })).toEqual({
      type: 'continue',
    })
  })

  test('normalizes case and ports at the domain boundary', () => {
    expect(
      decide('/offer', {
        host: 'CLIENT.Example.Test:443',
        rootDomain: 'EXAMPLE.TEST:443',
      })
    ).toEqual({ destination: '/client./offer', type: 'rewrite' })

    expect(
      decide('/offer', {
        host: 'client.localhost:3000',
        rootDomain: '.localhost:3000',
      })
    ).toEqual({ destination: '/client./offer', type: 'rewrite' })
  })

  test('keeps the production matcher contract for static and API paths', async () => {
    const middlewareSource = await Bun.file(
      new URL('../../src/middleware.ts', import.meta.url)
    ).text()
    expect(middlewareSource).toContain(
      "matcher: ['/((?!.+\\\\.[\\\\w]+$|_next).*)', '/', '/(api|trpc)(.*)']"
    )
    expect(middlewareSource).toContain(
      "import { clerkMiddleware } from '@clerk/nextjs/server'"
    )
    expect(middlewareSource).toContain('auth.protect()')
    expect(middlewareSource).not.toContain('authMiddleware')
  })
})
