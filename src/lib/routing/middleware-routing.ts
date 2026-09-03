export const PUBLIC_ROUTES = ['/site', '/api/uploadthing'] as const

export const isPublicPath = (pathname: string): boolean =>
  PUBLIC_ROUTES.some((publicRoute) => pathname === publicRoute)

export const enforcePathProtection = async (
  pathname: string,
  protect: () => Promise<unknown>
) => {
  if (!isPublicPath(pathname)) await protect()
}

export type RoutingDecision =
  | { destination: string; type: 'redirect' | 'rewrite' }
  | { type: 'continue' }

type RoutingInput = {
  host: string | null
  pathname: string
  rootDomain: string | undefined
  search: string
}

const normalizeHostname = (value: string | null | undefined) => {
  if (!value) return null
  const candidate = value.trim().toLowerCase()
  if (!/^[a-z0-9.-]+(?::\d+)?$/.test(candidate)) return null
  return candidate.replace(/:\d+$/, '').replace(/^\.+|\.+$/g, '') || null
}

export const resolveRoutingDecision = ({
  host,
  pathname,
  rootDomain,
  search,
}: RoutingInput): RoutingDecision => {
  const pathWithSearch = `${pathname}${search ? `?${search}` : ''}`
  const normalizedHost = normalizeHostname(host)
  const normalizedRootDomain = normalizeHostname(rootDomain)

  if (
    normalizedHost &&
    normalizedRootDomain &&
    normalizedHost.endsWith(`.${normalizedRootDomain}`)
  ) {
    const customSubdomain = normalizedHost.slice(
      0,
      -normalizedRootDomain.length
    )

    if (customSubdomain) {
      return {
        destination: `/${customSubdomain}${pathWithSearch}`,
        type: 'rewrite',
      }
    }
  }

  if (pathname === '/sign-in' || pathname === '/sign-up') {
    return { destination: '/agency/sign-in', type: 'redirect' }
  }

  if (
    pathname === '/' ||
    (pathname === '/site' && normalizedHost === normalizedRootDomain)
  ) {
    return { destination: '/site', type: 'rewrite' }
  }

  if (pathname.startsWith('/agency') || pathname.startsWith('/subaccount')) {
    return { destination: pathWithSearch, type: 'rewrite' }
  }

  return { type: 'continue' }
}
