// lib/middleware/withAuth.js

import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth/options'
import { resolveUserAdAccounts } from '@/lib/services/adAccountAccessService'
import { NextResponse } from 'next/server'

const log = {
  info:    (msg, data) => console.log(`[withAuth] ℹ️  ${msg}`, data ?? ''),
  success: (msg, data) => console.log(`[withAuth] ✅ ${msg}`, data ?? ''),
  warn:    (msg, data) => console.warn(`[withAuth] ⚠️  ${msg}`, data ?? ''),
  error:   (msg, data) => console.error(`[withAuth] ❌ ${msg}`, data ?? ''),
  section: (msg)       => console.log(`\n${'═'.repeat(55)}\n[withAuth] 🔒 ${msg}\n${'═'.repeat(55)}`),
}

export function withAuth(handler, options = {}) {
  return async (request, routeContext) => {
    const startTime = Date.now()
    const method    = request.method
    const url       = request.url

    log.section(`${method} ${new URL(url).pathname}`)

    // ── 1. Session check ──────────────────────────────────────────────────────
    log.info('Validating session...')
    const session = await getServerSession(authOptions)

    if (!session) {
      log.warn('No session found → 401', { url })
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (!session.user?.id) {
      log.warn('Session exists but has no user.id → 401', { session })
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    log.success('Session valid', {
      userId: session.user.id,
      email:  session.user.email,
      role:   session.user.role ?? 'user',
    })

    // ── 2. Resolve ad account access ──────────────────────────────────────────
    let adAccountAccess = null

    if (!options.skipAccessResolution) {
      log.info('Resolving ad account access...')
      try {
        adAccountAccess = await resolveUserAdAccounts(session.user.id)

        log.success('Access resolved', {
          isAdmin:     adAccountAccess.isAdmin,
          totalAccess: adAccountAccess.allIds.length,
          owned:       adAccountAccess.owned.length,
          shared:      adAccountAccess.shared.length,
        })
      } catch (error) {
        log.error('Failed to resolve ad account access', {
          userId: session.user.id,
          error:  error.message,
          stack:  error.stack,
        })
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
      }
    } else {
      log.info('Access resolution skipped (skipAccessResolution: true)')
    }

    // ── 3. Build context ──────────────────────────────────────────────────────
    const ctx = {
      session,
      userId: session.user.id,
      adAccountAccess,
    }

    const elapsed = Date.now() - startTime
    log.info(`Auth middleware complete in ${elapsed}ms — passing to handler`)

    return handler(request, routeContext, ctx)
  }
}

export function withAccountAccess(handler, requiredPermission = null) {
  return withAuth(async (request, routeContext, ctx) => {
    const adAccountId = routeContext?.params?.adAccountId

    log.info('Account-scoped access check', {
      adAccountId,
      requiredPermission: requiredPermission ?? 'none',
      userId: ctx.userId,
    })

    if (!adAccountId) {
      log.warn('Missing adAccountId in route params → 400')
      return NextResponse.json({ error: 'Missing adAccountId in route params' }, { status: 400 })
    }

    // ── Access check ──────────────────────────────────────────────────────────
    if (!ctx.adAccountAccess.canAccess(adAccountId)) {
      log.warn('Access DENIED — account not in user access set → 403', {
        userId:      ctx.userId,
        adAccountId,
        userHasAccessTo: ctx.adAccountAccess.allIds,
      })
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // ── Permission check ──────────────────────────────────────────────────────
    if (requiredPermission && !ctx.adAccountAccess.hasPermission(adAccountId, requiredPermission)) {
      // hasPermission already logs the denial detail — just block here
      return NextResponse.json(
        { error: `Missing required permission: ${requiredPermission}` },
        { status: 403 }
      )
    }

    ctx.currentAccount = ctx.adAccountAccess.getAccount(adAccountId)

    log.success('Account access granted', {
      userId:      ctx.userId,
      adAccountId,
      accountName: ctx.currentAccount?.name,
      accessType:  ctx.currentAccount?.accessType,
      permissions: ctx.currentAccount?.permissions,
    })

    return handler(request, routeContext, ctx)
  })
}