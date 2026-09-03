import { clerkMiddleware } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import {
  enforcePathProtection,
  resolveRoutingDecision,
} from '@/lib/routing/middleware-routing'

export default clerkMiddleware(async (auth, req) => {
  const url = req.nextUrl

  await enforcePathProtection(url.pathname, () => auth.protect())

  const decision = resolveRoutingDecision({
    host: req.headers.get('host'),
    pathname: url.pathname,
    rootDomain: process.env.NEXT_PUBLIC_DOMAIN,
    search: url.searchParams.toString(),
  })

  if (decision.type === 'redirect') {
    return NextResponse.redirect(new URL(decision.destination, req.url))
  }

  if (decision.type === 'rewrite') {
    return NextResponse.rewrite(new URL(decision.destination, req.url))
  }
})

export const config = {
  matcher: ['/((?!.+\\.[\\w]+$|_next).*)', '/', '/(api|trpc)(.*)'],
}
