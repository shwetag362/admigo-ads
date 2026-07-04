

// // app/api/meta-accounts/route.js
// import { prisma } from '@/lib/prisma'
// import { NextResponse } from 'next/server'
// import { getServerSession } from 'next-auth'
// import { authOptions } from '@/app/api/auth/[...nextauth]/route' // ← REQUIRED

// export async function GET(request) {
//   console.log('\n=== GET /api/meta-accounts STARTED ===')
//   console.log('Cookie header:', request.headers.get('cookie') || 'No cookies')

//   const session = await getServerSession(authOptions)

//   if (!session) {
//     console.log('getServerSession() → FAILED (session is null)')
//     return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
//   }

//   if (!session.user?.id) {
//     console.log('getServerSession() → FAILED (no user.id)')
//     console.log('Full session:', JSON.stringify(session, null, 2))
//     return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
//   }

//   console.log('getServerSession() → SUCCESS')
//   console.log('User ID →', session.user.id)
//   console.log('User email →', session.user.email || 'N/A')

//   try {
//     const accounts = await prisma.metaAdAccount.findMany({
//       where: { userId: session.user.id },
//       select: {
//         id: true,
//         name: true,
//         metaAccountId: true,
//         businessName: true,
//         currency: true,
//         createdAt: true,
//       },
//       orderBy: { createdAt: 'desc' },
//     })

//     console.log(`Found ${accounts.length} Meta Ad Account(s):`)
//     accounts.forEach(acc => console.log(`  • ${acc.name} (${acc.metaAccountId})`))

//     return NextResponse.json({ accounts })
//   } catch (error) {
//     console.error('Prisma GET error:', error.message)
//     return NextResponse.json({ error: 'Database error' }, { status: 500 })
//   }
// }

// export async function POST(request) {
//   console.log('\n=== POST /api/meta-accounts STARTED ===')
//   console.log('Cookie header:', request.headers.get('cookie')?.slice(0, 150) + '...' || 'No cookies')

//   const session = await getServerSession(authOptions)

//   if (!session) {
//     console.log('getServerSession() → FAILED (session null)')
//     return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
//   }

//   if (!session.user?.id) {
//     console.log('getServerSession() → FAILED (no user.id)')
//     console.log('Session dump:', JSON.stringify(session, null, 2))
//     return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
//   }

//   console.log('getServerSession() → SUCCESS')
//   console.log('Authenticated User ID →', session.user.id)

//   let body
//   try {
//     body = await request.json()
//     console.log('Request body →', body)
//   } catch (e) {
//     console.log('Invalid JSON received')
//     return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
//   }

//   const { name, metaAccountId, accessToken } = body

//   if (!name?.trim()) {
//     console.log('Validation failed → name missing')
//     return NextResponse.json({ error: 'Name is required' }, { status: 400 })
//   }
//   if (!metaAccountId?.startsWith('act_')) {
//     console.log('Validation failed → invalid metaAccountId:', metaAccountId)
//     return NextResponse.json({ error: 'Invalid Ad Account ID (must start with act_)' }, { status: 400 })
//   }
//   if (!accessToken?.trim()) {
//     console.log('Validation failed → accessToken missing')
//     return NextResponse.json({ error: 'Access token required' }, { status: 400 })
//   }

//   console.log('Saving Meta Ad Account...')
//   console.log(`→ Name: ${name}`)
//   console.log(`→ Account ID: ${metaAccountId}`)
//   console.log(`→ User ID: ${session.user.id}`)

//   try {
//     const account = await prisma.metaAdAccount.upsert({
//       where: { metaAccountId },
//       update: { name, accessToken },
//       create: {
//         userId: session.user.id,
//         name,
//         metaAccountId,
//         accessToken,
//         currency: 'USD',
//         timezone: 'America/Los_Angeles',
//         businessName: name,
//       },
//     })

//     console.log('SUCCESS! Account saved/updated')
//     console.log('Account ID →', account.id)

//     return NextResponse.json({ success: true, account })
//   } catch (error) {
//     console.error('PRISMA UPSERT FAILED:', error.message)
//     console.error('Full error:', error)
//     return NextResponse.json(
//       { error: 'Failed to save account', details: error.message },
//       { status: 500 }
//     )
//   }
// }

import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'
import { withAuth } from '@/lib/middleware/withAuth'

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/meta-accounts
// Returns all ad accounts the user owns OR can access via team membership.
// ─────────────────────────────────────────────────────────────────────────────
export const GET = withAuth(async (request, routeContext, ctx) => {
  console.log('\n=== GET /api/meta-accounts STARTED ===')
  console.log('User ID →', ctx.userId)

  try {
    const { all } = ctx.adAccountAccess

    console.log(`Found ${all.length} accessible Meta Ad Account(s):`)
    all.forEach(acc =>
      console.log(`  • [${acc.accessType}] ${acc.name} (${acc.metaAccountId})${acc.teamName ? ` via team: ${acc.teamName}` : ''}`)
    )

    // Strip sensitive fields, keep only what frontend needs
    const accounts = all.map(acc => ({
      id: acc.id,
      name: acc.name,
      metaAccountId: acc.metaAccountId,
      businessName: acc.businessName,
      currency: acc.currency,
      createdAt: acc.createdAt,
      // Team-aware fields
      accessType: acc.accessType,    // 'owner' | 'member'
      permissions: acc.permissions,  // ['*'] or ['view_campaigns', ...]
      teamId: acc.teamId,            // null if owner
      teamName: acc.teamName,        // null if owner
    }))

    return NextResponse.json({ accounts })
  } catch (error) {
    console.error('GET /api/meta-accounts error:', error.message)
    return NextResponse.json({ error: 'Database error' }, { status: 500 })
  }
})

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/meta-accounts
// Creates/updates an ad account owned by the authenticated user.
// skipAccessResolution: true — no need to resolve existing accounts for a create
// ─────────────────────────────────────────────────────────────────────────────
export const POST = withAuth(
  async (request, routeContext, ctx) => {
    console.log('\n=== POST /api/meta-accounts STARTED ===')
    console.log('Authenticated User ID →', ctx.userId)

    let body
    try {
      body = await request.json()
      console.log('Request body →', body)
    } catch (e) {
      console.log('Invalid JSON received')
      return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
    }

    const { name, metaAccountId, accessToken } = body

    if (!name?.trim()) {
      console.log('Validation failed → name missing')
      return NextResponse.json({ error: 'Name is required' }, { status: 400 })
    }
    if (!metaAccountId?.startsWith('act_')) {
      console.log('Validation failed → invalid metaAccountId:', metaAccountId)
      return NextResponse.json(
        { error: 'Invalid Ad Account ID (must start with act_)' },
        { status: 400 }
      )
    }
    if (!accessToken?.trim()) {
      console.log('Validation failed → accessToken missing')
      return NextResponse.json({ error: 'Access token required' }, { status: 400 })
    }

    console.log('Saving Meta Ad Account...')
    console.log(`→ Name: ${name}`)
    console.log(`→ Account ID: ${metaAccountId}`)
    console.log(`→ User ID: ${ctx.userId}`)

    try {
      const account = await prisma.metaAdAccount.upsert({
        where: { metaAccountId },
        update: { name, accessToken },
        create: {
          userId: ctx.userId,   // ← from ctx, not session directly
          name,
          metaAccountId,
          accessToken,
          currency: 'USD',
          timezone: 'America/Los_Angeles',
          businessName: name,
        },
      })

      console.log('SUCCESS! Account saved/updated → ID:', account.id)
      return NextResponse.json({ success: true, account })
    } catch (error) {
      console.error('PRISMA UPSERT FAILED:', error.message)
      console.error('Full error:', error)
      return NextResponse.json(
        { error: 'Failed to save account', details: error.message },
        { status: 500 }
      )
    }
  },
  { skipAccessResolution: true } // POST creates a new account — no need to resolve existing access
)