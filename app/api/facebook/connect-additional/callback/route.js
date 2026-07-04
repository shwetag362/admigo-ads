// app/api/facebook/connect-additional/callback/route.js
import { getServerSession } from "next-auth";
import { authOptions } from "../../../auth/[...nextauth]/route";
import { NextResponse } from "next/server";
import { prisma } from "../../../../../lib/prisma";

/**
 * Callback handler for connecting ADDITIONAL Facebook accounts
 * This is separate from the main NextAuth flow
 */
export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get('code');
  const state = searchParams.get('state');
  const error = searchParams.get('error');

  console.log('\n========== ADDITIONAL FACEBOOK ACCOUNT CALLBACK ==========');

  // Handle OAuth errors
  if (error) {
    console.error('❌ Facebook OAuth error:', error);
    return NextResponse.redirect(
      `${process.env.NEXTAUTH_URL}/dashboard/accounts?error=${error}`
    );
  }

  if (!code) {
    console.error('❌ No authorization code received');
    return NextResponse.redirect(
      `${process.env.NEXTAUTH_URL}/dashboard/settings/add-f-accounts?error=no_code`
    );
  }

  try {
    // Decode and validate state
    const stateData = JSON.parse(Buffer.from(state, 'base64').toString());
    console.log('📋 State data:', stateData);

    if (!stateData.isAdditionalAccount) {
      throw new Error('Invalid state - not an additional account request');
    }

    // Verify user is still logged in
    const session = await getServerSession(authOptions);
    
    if (!session || !session.user || session.user.id !== stateData.userId) {
      console.error('❌ Session mismatch or user not logged in');
      return NextResponse.redirect(
        `${process.env.NEXTAUTH_URL}/login?error=session_expired`
      );
    }

    console.log(`✅ Valid session for user: ${session.user.email}`);

    // ============================================================
    // STEP 1: Exchange code for access token
    // ============================================================
    console.log('\n📍 Step 1: Exchanging authorization code for access token');
    
    const tokenResponse = await fetch(
      'https://graph.facebook.com/v24.0/oauth/access_token?' +
      new URLSearchParams({
        client_id: process.env.FACEBOOK_CLIENT_ID,
        client_secret: process.env.FACEBOOK_CLIENT_SECRET,
        redirect_uri: `${process.env.NEXTAUTH_URL}/api/facebook/connect-additional/callback`,
        code: code,
      })
    );

    if (!tokenResponse.ok) {
      const errorText = await tokenResponse.text();
      console.error('❌ Token exchange failed:', errorText);
      throw new Error('Failed to exchange authorization code');
    }

    const tokenData = await tokenResponse.json();
    console.log('✅ Short-lived token obtained');

    // ============================================================
    // STEP 2: Exchange for long-lived token (60 days)
    // ============================================================
    console.log('\n📍 Step 2: Exchanging for long-lived token');
    
    const longLivedResponse = await fetch(
      'https://graph.facebook.com/v24.0/oauth/access_token?' +
      new URLSearchParams({
        grant_type: 'fb_exchange_token',
        client_id: process.env.FACEBOOK_CLIENT_ID,
        client_secret: process.env.FACEBOOK_CLIENT_SECRET,
        fb_exchange_token: tokenData.access_token,
      })
    );

    let finalToken = tokenData.access_token;
    let expiresIn = 5184000; // Default 60 days

    if (longLivedResponse.ok) {
      const longLivedData = await longLivedResponse.json();
      finalToken = longLivedData.access_token;
      expiresIn = longLivedData.expires_in || expiresIn;
      console.log(`✅ Long-lived token obtained (expires in ${Math.floor(expiresIn / 86400)} days)`);
    } else {
      console.warn('⚠️  Could not get long-lived token, using short-lived');
    }

    const tokenExpiresAt = new Date(Date.now() + expiresIn * 1000);

    // ============================================================
    // STEP 3: Get Facebook user info
    // ============================================================
    console.log('\n📍 Step 3: Fetching Facebook user profile');
    
    const userResponse = await fetch(
      `https://graph.facebook.com/v24.0/me?fields=id,name,email&access_token=${finalToken}`
    );

    if (!userResponse.ok) {
      const errorText = await userResponse.text();
      console.error('❌ Failed to fetch user profile:', errorText);
      throw new Error('Failed to fetch Facebook user profile');
    }

    const fbUser = await userResponse.json();
    console.log(`✅ Facebook user profile fetched:`);
    console.log(`   Facebook ID: ${fbUser.id}`);
    console.log(`   Name: ${fbUser.name}`);
    console.log(`   Email: ${fbUser.email || 'Not available'}`);

    // ============================================================
    // STEP 4: Check if this Facebook account is already connected
    // ============================================================
    console.log('\n📍 Step 4: Checking for existing connections');
    
    const existingFbAccount = await prisma.facebookAccount.findFirst({
      where: {
        facebookUserId: fbUser.id,
      },
      include: {
        user: {
          select: {
            email: true,
          },
        },
      },
    });

    if (existingFbAccount) {
      if (existingFbAccount.userId === session.user.id) {
        console.log('⚠️  This Facebook account is already connected to your account');
        return NextResponse.redirect(
          `${process.env.NEXTAUTH_URL}/dashboard/settings/add-f-accounts?error=already_connected_same_user`
        );
      } else {
        console.log(`⚠️  This Facebook account is connected to another user: ${existingFbAccount.user.email}`);
        return NextResponse.redirect(
          `${process.env.NEXTAUTH_URL}/dashboard/settings/add-f-accounts?error=already_connected_different_user`
        );
      }
    }

    console.log('✅ Facebook account is not connected anywhere');

    // ============================================================
    // STEP 5: Fetch ad accounts
    // ============================================================
    console.log('\n📍 Step 5: Fetching ad accounts');
    
    const adAccountsResponse = await fetch(
      `https://graph.facebook.com/v24.0/me/adaccounts?fields=id,name,account_id,account_status,currency,timezone_name,business&access_token=${finalToken}`
    );

    let adAccounts = [];
    if (adAccountsResponse.ok) {
      const adAccountsData = await adAccountsResponse.json();
      adAccounts = adAccountsData.data || [];
      console.log(`✅ Found ${adAccounts.length} ad account(s)`);
      
      adAccounts.forEach((acc, idx) => {
        console.log(`   ${idx + 1}. ${acc.name} (ID: ${acc.id})`);
      });
    } else {
      console.warn('⚠️  Could not fetch ad accounts');
    }

    // ============================================================
    // STEP 6: Save to database IN A TRANSACTION
    // ============================================================
    console.log('\n📍 Step 6: Saving Facebook account and ad accounts to database');
    
    // ✅ FIX: Use transaction to create BOTH FacebookAccount AND OAuthAccount together
    await prisma.$transaction(async (tx) => {
      // Create FacebookAccount (always non-primary for additional accounts)
      const newFacebookAccount = await tx.facebookAccount.create({
        data: {
          userId: session.user.id,
          facebookUserId: fbUser.id,
          facebookUserName: fbUser.name,
          accessToken: finalToken,
          refreshToken: null,
          tokenExpiresAt: tokenExpiresAt,
          isActive: true,
          isPrimary: false, // Additional accounts are never primary by default
        },
      });

      console.log('✅ Facebook account created:');
      console.log(`   ID: ${newFacebookAccount.id}`);
      console.log(`   Facebook User ID: ${newFacebookAccount.facebookUserId}`);
      console.log(`   Is Primary: ${newFacebookAccount.isPrimary}`);

      // ✅ FIX: Create OAuthAccount with correct schema field names
      await tx.oAuthAccount.create({
        data: {
          userId: session.user.id,
          provider: 'facebook',
          providerAccountId: fbUser.id,
          accessToken: finalToken,      // ✅ camelCase
          refreshToken: null,            // ✅ camelCase
          expiresAt: tokenExpiresAt,     // ✅ DateTime object
        },
      });

      console.log('✅ OAuth account created');

      // Save ad accounts
      let savedAdAccountsCount = 0;
      
      for (const adAccount of adAccounts) {
        try {
          const businessName = adAccount.business?.name || null;

          await tx.metaAdAccount.create({
            data: {
              userId: session.user.id,
              facebookAccountId: newFacebookAccount.id,
              metaAccountId: adAccount.id,
              name: adAccount.name,
              currency: adAccount.currency,
              timezone: adAccount.timezone_name,
              businessName: businessName,
              accessToken: finalToken,
            },
          });

          savedAdAccountsCount++;
          console.log(`   ✅ Created ad account: ${adAccount.name}`);
          
        } catch (adError) {
          console.error(`   ❌ Failed to save ad account: ${adAccount.name}`);
          console.error(`      Error: ${adError.message}`);
          // Don't throw - continue with other accounts
        }
      }

      console.log(`\n✅ Saved ${savedAdAccountsCount}/${adAccounts.length} ad accounts`);
    });

    console.log('\n========== ADDITIONAL FACEBOOK ACCOUNT CONNECTED SUCCESSFULLY ==========\n');

    // Redirect back to accounts page with success message
    return NextResponse.redirect(
      `${process.env.NEXTAUTH_URL}/dashboard/settings/add-f-accounts?success=account_connected&name=${encodeURIComponent(fbUser.name)}`
    );

  } catch (error) {
    console.error('\n❌ Error in additional Facebook account callback:');
    console.error('   Error:', error.message);
    console.error('   Stack:', error.stack);
    console.log('========== CALLBACK END (WITH ERROR) ==========\n');

    return NextResponse.redirect(
      `${process.env.NEXTAUTH_URL}/dashboard/settings/add-f-accounts?error=connection_failed`
    );
  }
}