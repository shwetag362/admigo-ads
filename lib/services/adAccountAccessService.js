// lib/services/adAccountAccessService.js

import { prisma } from '@/lib/prisma'

// ─── Internal logger ──────────────────────────────────────────────────────────
// Structured logs with emoji prefixes for easy grepping in terminal
const log = {
  info:    (msg, data) => console.log(`  [Access] ℹ️  ${msg}`, data ?? ''),
  success: (msg, data) => console.log(`  [Access] ✅ ${msg}`, data ?? ''),
  warn:    (msg, data) => console.warn(`  [Access] ⚠️  ${msg}`, data ?? ''),
  error:   (msg, data) => console.error(`  [Access] ❌ ${msg}`, data ?? ''),
  admin:   (msg, data) => console.log(`  [Access] 🛡️  ${msg}`, data ?? ''),
  member:  (msg, data) => console.log(`  [Access] 👥 ${msg}`, data ?? ''),
  owner:   (msg, data) => console.log(`  [Access] 👤 ${msg}`, data ?? ''),
  debug:   (msg, data) => {
    if (process.env.NODE_ENV === 'development') {
      console.log(`  [Access] 🔍 ${msg}`, data ?? '')
    }
  },
  section: (msg)       => console.log(`\n  ${'─'.repeat(50)}\n  [Access] 🔐 ${msg}\n  ${'─'.repeat(50)}`),
}

/**
 * Resolves all ad accounts a user can access.
 *
 * Access levels:
 *   admin  → all accounts in the system, all permissions
 *   owner  → accounts they created/own, all permissions
 *   member → accounts shared via team membership, scoped permissions
 */
export async function resolveUserAdAccounts(userId) {
  const startTime = Date.now()

  log.section(`Resolving access for user: ${userId}`)

  // ── 1. Fetch user role ────────────────────────────────────────────────────
  log.info('Fetching user role from DB...')

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { role: true },
  })

  if (!user) {
    log.error(`User not found in DB`, { userId })
    // Return empty access rather than crashing — withAuth already validated session
    return buildEmptyAccess()
  }

  log.info(`Role resolved`, { userId, role: user.role })

  // ── 2. Admin path ─────────────────────────────────────────────────────────
  if (user.role === 'admin') {
    log.admin(`ADMIN ACCESS PATH — fetching all accounts in system`)

    const allAccounts = await prisma.metaAdAccount.findMany()

    const all = allAccounts.map(acc => ({
      ...acc,
      accessType: 'admin',
      permissions: ['*'],
      teamId: null,
      teamName: null,
    }))

    const elapsed = Date.now() - startTime

    log.admin(`Admin access resolved`, {
      userId,
      role: 'admin',
      totalAccounts: all.length,
      accountNames: all.map(a => a.name),
      resolvedIn: `${elapsed}ms`,
    })

    console.log(`  [Access] 🛡️  Admin ${userId} has access to ALL ${all.length} accounts\n`)

    return {
      owned:   [],
      shared:  [],
      all,
      allIds:  all.map(a => a.id),
      isAdmin: true,

      canAccess:     () => true,
      hasPermission: () => true,
      getAccount:    (adAccountId) => all.find(a => a.id === adAccountId) ?? null,
    }
  }

  // ── 3. Normal user path ───────────────────────────────────────────────────
  log.info(`USER ACCESS PATH — fetching owned + team accounts`, { userId, role: user.role })

  const [ownedAccounts, teamMemberAccounts] = await Promise.all([
    prisma.metaAdAccount.findMany({
      where: { userId },
    }),

    prisma.teamMemberAccount.findMany({
      where: {
        teamMember: { userId },
      },
      include: {
        adAccount: true,
        teamMember: {
          include: { team: true },
        },
      },
    }),
  ])

  // ── Log owned accounts ────────────────────────────────────────────────────
  log.owner(`Owned accounts found`, {
    count: ownedAccounts.length,
    accounts: ownedAccounts.map(a => ({
      id:   a.id,
      name: a.name,
      metaAccountId: a.metaAccountId,
    })),
  })

  // ── Log team member accounts ──────────────────────────────────────────────
  log.member(`Team shared accounts found`, {
    count: teamMemberAccounts.length,
    accounts: teamMemberAccounts.map(tma => ({
      id:          tma.adAccount.id,
      name:        tma.adAccount.name,
      teamId:      tma.teamMember.teamId,
      teamName:    tma.teamMember.team.name,
      permissions: tma.permissions,
    })),
  })

  const owned = ownedAccounts.map(acc => ({
    ...acc,
    accessType:  'owner',
    permissions: ['*'],
    teamId:      null,
    teamName:    null,
  }))

  const shared = teamMemberAccounts.map(tma => ({
    ...tma.adAccount,
    accessType:  'member',
    permissions: tma.permissions,
    teamId:      tma.teamMember.teamId,
    teamName:    tma.teamMember.team.name,
  }))

  // ── Deduplicate ───────────────────────────────────────────────────────────
  const ownedIds     = new Set(owned.map(a => a.id))
  const dedupedShared = shared.filter(a => !ownedIds.has(a.id))

  const dupes = shared.filter(a => ownedIds.has(a.id))
  if (dupes.length > 0) {
    log.warn(`Deduplication removed ${dupes.length} account(s) that user both owns and is a member of`, {
      dedupedAccounts: dupes.map(a => ({ id: a.id, name: a.name, teamName: a.teamName })),
    })
  }

  const all = [...owned, ...dedupedShared]

  // ── Permission breakdown log ──────────────────────────────────────────────
  if (process.env.NODE_ENV === 'development') {
    log.debug(`Permission breakdown for user ${userId}`, {
      owned: owned.map(a => ({
        id:   a.id,
        name: a.name,
        accessType: 'owner',
        permissions: ['*'],
      })),
      shared: dedupedShared.map(a => ({
        id:   a.id,
        name: a.name,
        accessType: 'member',
        teamName:   a.teamName,
        permissions: a.permissions,
      })),
    })
  }

  const elapsed = Date.now() - startTime

  log.success(`Access resolved for user ${userId}`, {
    role:          user.role,
    ownedCount:    owned.length,
    sharedCount:   dedupedShared.length,
    totalAccess:   all.length,
    allIds:        all.map(a => a.id),
    resolvedIn:    `${elapsed}ms`,
  })

  console.log(`  [Access] ✅ User ${userId} → ${owned.length} owned + ${dedupedShared.length} shared = ${all.length} total accounts\n`)

  return {
    owned,
    shared: dedupedShared,
    all,
    allIds: all.map(a => a.id),
    isAdmin: false,

    canAccess: (adAccountId) => {
      const result = all.some(a => a.id === adAccountId)
      log.debug(`canAccess(${adAccountId})`, { result, userId })
      return result
    },

    hasPermission: (adAccountId, permission) => {
      const account = all.find(a => a.id === adAccountId)

      if (!account) {
        log.warn(`hasPermission check — account not found in access set`, {
          userId, adAccountId, permission,
        })
        return false
      }

      const granted =
        account.permissions.includes('*') ||
        account.permissions.includes(permission)

      log.debug(`hasPermission(${adAccountId}, "${permission}")`, {
        accessType:  account.accessType,
        permissions: account.permissions,
        granted,
      })

      if (!granted) {
        log.warn(`Permission DENIED`, {
          userId,
          adAccountId,
          accountName:    account.name,
          accessType:     account.accessType,
          requiredPerm:   permission,
          userPerms:      account.permissions,
        })
      }

      return granted
    },

    getAccount: (adAccountId) => {
      const account = all.find(a => a.id === adAccountId) ?? null
      log.debug(`getAccount(${adAccountId})`, {
        found:      !!account,
        accessType: account?.accessType ?? 'none',
      })
      return account
    },
  }
}

// ─── Empty access (returned when user not found in DB) ────────────────────────
function buildEmptyAccess() {
  return {
    owned:   [],
    shared:  [],
    all:     [],
    allIds:  [],
    isAdmin: false,
    canAccess:     () => false,
    hasPermission: () => false,
    getAccount:    () => null,
  }
}