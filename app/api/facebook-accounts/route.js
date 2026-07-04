// app/api/facebook-accounts/route.js
import { getServerSession } from "next-auth";
import { authOptions } from "../auth/[...nextauth]/route";
import { NextResponse } from "next/server";
import { prisma } from "../../../lib/prisma";

/**
 * GET - List all Facebook accounts for the current user
 */
export async function GET(request) {
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('📋 FETCH FACEBOOK ACCOUNTS');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`📅 Timestamp: ${new Date().toISOString()}\n`);

  try {
    const session = await getServerSession(authOptions);
    
    if (!session || !session.user) {
      console.log('❌ UNAUTHORIZED: No active session');
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    console.log('✅ Session validated');
    console.log(`👤 User ID: ${session.user.id}`);
    console.log(`📧 Email: ${session.user.email || 'Not available'}\n`);

    // Check for query parameters
    const { searchParams } = new URL(request.url);
    const includeInactive = searchParams.get('includeInactive') === 'true';

    console.log('🔍 Query Parameters:');
    console.log(`   Include Inactive: ${includeInactive}\n`);

    console.log('📊 Fetching Facebook accounts from database...');
    const accounts = await prisma.facebookAccount.findMany({
      where: { 
        userId: session.user.id,
        ...(includeInactive ? {} : { isActive: true }), // ✅ Filter by active unless requested
      },
      include: {
        _count: {
          select: {
            adAccounts: true,
          },
        },
      },
      orderBy: [
        { isPrimary: 'desc' },  // Primary first
        { createdAt: 'desc' },  // Then newest first
      ],
    });

    console.log(`✅ Found ${accounts.length} Facebook account(s)\n`);

    if (accounts.length > 0) {
      console.log('📋 Account Summary:');
      const now = new Date();
      accounts.forEach((account, idx) => {
        const daysUntilExpiry = Math.floor(
          (account.tokenExpiresAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
        );
        
        console.log(`   ${idx + 1}. ${account.facebookUserName}`);
        console.log(`      • ID: ${account.id}`);
        console.log(`      • Facebook User ID: ${account.facebookUserId}`);
        console.log(`      • Is Primary: ${account.isPrimary}`);
        console.log(`      • Is Active: ${account.isActive}`);
        console.log(`      • Ad Accounts: ${account._count.adAccounts}`);
        console.log(`      • Token Expires: ${account.tokenExpiresAt.toISOString()}`);
        console.log(`      • Days Until Expiry: ${daysUntilExpiry}`);
        if (daysUntilExpiry < 0) {
          console.log(`      • ⚠️  STATUS: EXPIRED`);
        } else if (daysUntilExpiry < 7) {
          console.log(`      • ⚠️  STATUS: EXPIRING SOON`);
        } else {
          console.log(`      • ✅ STATUS: VALID`);
        }
      });
      console.log('');
    }

    // Calculate token status for each account
    const now = new Date();
    const formattedAccounts = accounts.map(account => {
      const daysUntilExpiry = Math.floor(
        (account.tokenExpiresAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
      );

      return {
        id: account.id,
        facebookUserId: account.facebookUserId,
        facebookUserName: account.facebookUserName,
        isActive: account.isActive,
        isPrimary: account.isPrimary,
        tokenExpiresAt: account.tokenExpiresAt,
        createdAt: account.createdAt,
        adAccountsCount: account._count.adAccounts,
        // ✅ Add token status information
        tokenStatus: {
          isExpired: daysUntilExpiry < 0,
          daysUntilExpiry: daysUntilExpiry,
          needsRefresh: daysUntilExpiry < 7 && daysUntilExpiry >= 0,
          status: daysUntilExpiry < 0 
            ? 'expired' 
            : daysUntilExpiry < 7 
            ? 'expiring_soon' 
            : 'valid',
        },
      };
    });

    console.log('✅ Response prepared with token status for all accounts');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('🏁 FETCH COMPLETE');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    return NextResponse.json({ accounts: formattedAccounts });

  } catch (error) {
    console.error('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.error('💥 ERROR FETCHING FACEBOOK ACCOUNTS');
    console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.error(`Error Type: ${error.name || 'Unknown'}`);
    console.error(`Error Message: ${error.message}`);
    console.error('Stack Trace:');
    console.error(error.stack);
    console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * DELETE - Disconnect a Facebook account (soft delete)
 */
export async function DELETE(request) {
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('🗑️  DISCONNECT FACEBOOK ACCOUNT');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`📅 Timestamp: ${new Date().toISOString()}\n`);

  try {
    const session = await getServerSession(authOptions);
    
    if (!session || !session.user) {
      console.log('❌ UNAUTHORIZED: No active session');
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { accountId } = await request.json();

    console.log('✅ Session validated');
    console.log(`👤 User ID: ${session.user.id}`);
    console.log(`📧 Email: ${session.user.email || 'Not available'}`);
    console.log(`🗑️  Account to disconnect: ${accountId}\n`);

    // Use transaction for atomic operations
    console.log('🔒 Starting atomic transaction...\n');
    
    const result = await prisma.$transaction(async (tx) => {
      // Find the account
      console.log('   🔍 Step 1: Finding Facebook account...');
      const account = await tx.facebookAccount.findFirst({
        where: {
          id: accountId,
          userId: session.user.id,
        },
      });

      if (!account) {
        console.log('   ❌ Account not found');
        throw new Error('ACCOUNT_NOT_FOUND');
      }

      console.log('   ✅ Account found');
      console.log(`      Name: ${account.facebookUserName}`);
      console.log(`      Facebook User ID: ${account.facebookUserId}`);
      console.log(`      Is Primary: ${account.isPrimary}`);
      console.log(`      Is Active: ${account.isActive}\n`);

      // ✅ Check if user has other active auth methods
      console.log('   🔍 Step 2: Checking for other authentication methods...');
      
      const activeFacebookAccounts = await tx.facebookAccount.count({
        where: {
          userId: session.user.id,
          isActive: true,
          id: { not: accountId }, // Exclude current account
        },
      });

      const user = await tx.user.findUnique({
        where: { id: session.user.id },
        select: { passwordHash: true },
      });

      const hasPassword = !!user.passwordHash;
      const hasOtherFacebookAccounts = activeFacebookAccounts > 0;

      console.log(`      Has Password: ${hasPassword}`);
      console.log(`      Other Active Facebook Accounts: ${activeFacebookAccounts}`);
      console.log(`      Total Auth Methods: ${(hasPassword ? 1 : 0) + activeFacebookAccounts}\n`);

      // ✅ Prevent locking user out
      if (!hasPassword && !hasOtherFacebookAccounts) {
        console.log('   ❌ BLOCKED: Cannot disconnect last authentication method');
        console.log('      User would be locked out of their account');
        throw new Error('LAST_AUTH_METHOD');
      }

      console.log('   ✅ Safe to disconnect - user has other auth methods\n');

      // ✅ If disconnecting primary, promote another account
      if (account.isPrimary && hasOtherFacebookAccounts) {
        console.log('   🔄 Step 3: Promoting another account to primary...');
        
        const nextAccount = await tx.facebookAccount.findFirst({
          where: {
            userId: session.user.id,
            id: { not: accountId },
            isActive: true,
          },
          orderBy: { createdAt: 'asc' }, // Promote oldest
        });

        if (nextAccount) {
          await tx.facebookAccount.update({
            where: { id: nextAccount.id },
            data: { isPrimary: true },
          });
          console.log(`   ✅ Promoted "${nextAccount.facebookUserName}" to primary`);
          console.log(`      New Primary Account ID: ${nextAccount.id}\n`);
        }
      } else if (!account.isPrimary) {
        console.log('   ℹ️  Step 3: Skipped (account is not primary)\n');
      }

      // ✅ Soft delete: set inactive
      console.log('   🔄 Step 4: Deactivating Facebook account...');
      await tx.facebookAccount.update({
        where: { id: accountId },
        data: { 
          isActive: false,
          isPrimary: false, // Remove primary status
          updatedAt: new Date(),
        },
      });
      console.log('   ✅ Facebook account deactivated\n');

      // ✅ Delete corresponding OAuth account
      console.log('   🔄 Step 5: Removing OAuth account...');
      const deletedOAuthAccounts = await tx.oAuthAccount.deleteMany({
        where: {
          userId: session.user.id,
          provider: 'facebook',
          providerAccountId: account.facebookUserId,
        },
      });
      console.log(`   ✅ Deleted ${deletedOAuthAccounts.count} OAuth account(s)\n`);

      // Get updated counts
      const remainingActiveAccounts = await tx.facebookAccount.count({
        where: {
          userId: session.user.id,
          isActive: true,
        },
      });

      console.log('   📊 Summary:');
      console.log(`      Disconnected: ${account.facebookUserName}`);
      console.log(`      Remaining Active Accounts: ${remainingActiveAccounts}`);
      console.log(`      OAuth Accounts Deleted: ${deletedOAuthAccounts.count}`);

      return { 
        success: true,
        accountName: account.facebookUserName,
        remainingAccounts: remainingActiveAccounts,
      };
    });

    console.log('\n✅ Transaction completed successfully');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('🎉 FACEBOOK ACCOUNT DISCONNECTED');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`Account: ${result.accountName}`);
    console.log(`Remaining: ${result.remainingAccounts}`);
    console.log(`Timestamp: ${new Date().toISOString()}`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    return NextResponse.json({ 
      success: true,
      message: `Account "${result.accountName}" disconnected successfully`,
      remainingAccounts: result.remainingAccounts,
    });

  } catch (error) {
    console.error('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.error('💥 ERROR DISCONNECTING FACEBOOK ACCOUNT');
    console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.error(`Error Type: ${error.name || 'Unknown'}`);
    console.error(`Error Message: ${error.message}`);
    console.error('Stack Trace:');
    console.error(error.stack);
    console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    // ✅ Handle specific errors with helpful messages
    if (error.message === 'ACCOUNT_NOT_FOUND') {
      return NextResponse.json(
        { 
          error: 'Account not found',
          details: 'The Facebook account you tried to disconnect does not exist or does not belong to you.'
        },
        { status: 404 }
      );
    }

    if (error.message === 'LAST_AUTH_METHOD') {
      return NextResponse.json(
        { 
          error: 'Cannot disconnect your only authentication method',
          details: 'Please set a password or connect another Facebook account before disconnecting this one.',
          suggestion: 'Go to Settings → Security to add a password'
        },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { 
        error: 'Internal server error',
        details: 'An unexpected error occurred while disconnecting the account.'
      },
      { status: 500 }
    );
  }
}