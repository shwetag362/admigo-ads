// app/api/facebook-accounts/set-primary/route.js
import { getServerSession } from "next-auth";
import { authOptions } from "../../auth/[...nextauth]/route";
import { NextResponse } from "next/server";
import { prisma } from "../../../../lib/prisma";

/**
 * POST - Set a Facebook account as primary
 */
export async function POST(request) {
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('⭐ SET PRIMARY FACEBOOK ACCOUNT');
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
    console.log(`⭐ Account to set as primary: ${accountId}\n`);

    // ✅ Use transaction for atomic operations
    console.log('🔒 Starting atomic transaction...\n');
    
    const result = await prisma.$transaction(async (tx) => {
      // Verify the account belongs to this user and is active
      console.log('   🔍 Step 1: Verifying account ownership and status...');
      const account = await tx.facebookAccount.findFirst({
        where: {
          id: accountId,
          userId: session.user.id,
          isActive: true, // ✅ Only allow active accounts to be primary
        },
      });

      if (!account) {
        console.log('   ❌ Account not found, inactive, or does not belong to user');
        throw new Error('ACCOUNT_NOT_FOUND');
      }

      console.log('   ✅ Account verified');
      console.log(`      Name: ${account.facebookUserName}`);
      console.log(`      Facebook User ID: ${account.facebookUserId}`);
      console.log(`      Current Primary Status: ${account.isPrimary}`);
      console.log(`      Is Active: ${account.isActive}\n`);

      // If already primary, do nothing
      if (account.isPrimary) {
        console.log('   ℹ️  Account is already set as primary');
        console.log('   Skipping database updates\n');
        return { 
          alreadyPrimary: true,
          accountName: account.facebookUserName,
        };
      }

      // Get current primary account
      console.log('   🔍 Step 2: Finding current primary account...');
      const currentPrimary = await tx.facebookAccount.findFirst({
        where: {
          userId: session.user.id,
          isPrimary: true,
        },
      });

      if (currentPrimary) {
        console.log('   ✅ Found current primary account');
        console.log(`      Name: ${currentPrimary.facebookUserName}`);
        console.log(`      ID: ${currentPrimary.id}\n`);
      } else {
        console.log('   ⚠️  No current primary account found\n');
      }

      // Set all accounts to non-primary
      console.log('   🔄 Step 3: Removing primary status from all accounts...');
      const updateResult = await tx.facebookAccount.updateMany({
        where: { userId: session.user.id },
        data: { isPrimary: false },
      });
      console.log(`   ✅ Updated ${updateResult.count} account(s) to non-primary\n`);

      // Set the selected account as primary
      console.log('   🔄 Step 4: Setting new primary account...');
      await tx.facebookAccount.update({
        where: { id: accountId },
        data: { 
          isPrimary: true,
          updatedAt: new Date(),
        },
      });
      console.log(`   ✅ "${account.facebookUserName}" is now the primary account\n`);

      // Verify the change
      const verifyPrimary = await tx.facebookAccount.findUnique({
        where: { id: accountId },
        select: { isPrimary: true },
      });

      console.log('   ✅ Step 5: Verification');
      console.log(`      New primary status confirmed: ${verifyPrimary.isPrimary}`);

      return { 
        alreadyPrimary: false,
        accountName: account.facebookUserName,
        previousPrimary: currentPrimary?.facebookUserName || null,
      };
    });

    console.log('\n✅ Transaction completed successfully');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('🎉 PRIMARY ACCOUNT UPDATED');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`New Primary: ${result.accountName}`);
    if (result.previousPrimary) {
      console.log(`Previous Primary: ${result.previousPrimary}`);
    }
    console.log(`Already Primary: ${result.alreadyPrimary}`);
    console.log(`Timestamp: ${new Date().toISOString()}`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    const message = result.alreadyPrimary 
      ? `"${result.accountName}" is already your primary account`
      : `"${result.accountName}" is now your primary account`;

    return NextResponse.json({ 
      success: true,
      message: message,
      alreadyPrimary: result.alreadyPrimary,
      accountName: result.accountName,
      previousPrimary: result.previousPrimary,
    });

  } catch (error) {
    console.error('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.error('💥 ERROR SETTING PRIMARY ACCOUNT');
    console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.error(`Error Type: ${error.name || 'Unknown'}`);
    console.error(`Error Message: ${error.message}`);
    console.error('Stack Trace:');
    console.error(error.stack);
    console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    // ✅ Handle specific errors
    if (error.message === 'ACCOUNT_NOT_FOUND') {
      return NextResponse.json(
        { 
          error: 'Account not found or inactive',
          details: 'The Facebook account you tried to set as primary does not exist, is inactive, or does not belong to you.',
        },
        { status: 404 }
      );
    }

    return NextResponse.json(
      { 
        error: 'Internal server error',
        details: 'An unexpected error occurred while setting the primary account.',
      },
      { status: 500 }
    );
  }
}