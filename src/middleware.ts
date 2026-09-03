import { authMiddleware } from '@clerk/nextjs'
import { NextResponse } from 'next/server'
import {
  PUBLIC_ROUTES,
  resolveRoutingDecision,
} from '@/lib/routing/middleware-routing'

// This example protects all routes including api/trpc routes
// Please edit this to allow other routes to be public as needed.
// See https://clerk.com/docs/references/nextjs/auth-middleware for more information about configuring your Middleware
export default authMiddleware({
  publicRoutes: [...PUBLIC_ROUTES],
  async beforeAuth(auth, req) {},
  async afterAuth(auth, req) {
    const url = req.nextUrl
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
  },
})

export const config = {
  matcher: ['/((?!.+\\.[\\w]+$|_next).*)', '/', '/(api|trpc)(.*)'],
}
