// app/api/facebook/connect-additional/route.js
import { getServerSession } from "next-auth";
import { authOptions } from "../../auth/[...nextauth]/route";
import { NextResponse } from "next/server";

/**
 * This endpoint initiates the Facebook OAuth flow for connecting
 * an ADDITIONAL Facebook account to an already logged-in user.
 * 
 * Flow:
 * 1. User clicks "Connect Another Facebook Account" in dashboard
 * 2. This endpoint redirects to Facebook OAuth with special state parameter
 * 3. Facebook redirects back to our callback
 * 4. Callback detects it's an "additional" connection and creates new FacebookAccount
 */
export async function GET(request) {
  try {
    // Get current session - user must be logged in
    const session = await getServerSession(authOptions);
    
    if (!session || !session.user) {
      return NextResponse.json(
        { error: 'You must be logged in to connect additional accounts' },
        { status: 401 }
      );
    }

    console.log('\n🔗 Additional Facebook Account Connection Request');
    console.log(`   User ID: ${session.user.id}`);
    console.log(`   User Email: ${session.user.email}`);

    // Create state parameter with user info and "additional account" flag
    const state = Buffer.from(JSON.stringify({
      userId: session.user.id,
      isAdditionalAccount: true,
      timestamp: Date.now(),
      // Add CSRF token in production
    })).toString('base64');

    // Build Facebook OAuth URL
    const fbAuthUrl = new URL('https://www.facebook.com/v24.0/dialog/oauth');
    fbAuthUrl.searchParams.set('client_id', process.env.FACEBOOK_CLIENT_ID);
    fbAuthUrl.searchParams.set('redirect_uri', `${process.env.NEXTAUTH_URL}/api/facebook/connect-additional/callback`);
    fbAuthUrl.searchParams.set('state', state);
    fbAuthUrl.searchParams.set('scope', [
      'email',
      'public_profile',
      'ads_management',
      'ads_read',
      'business_management',
      'pages_show_list',
      'pages_read_engagement',
      'instagram_basic',
      'pages_manage_ads',
    //   'leads_retrieval',
    ].join(','));
    fbAuthUrl.searchParams.set('response_type', 'code');

    console.log('   ✅ Redirecting to Facebook OAuth');
    console.log(`   State: ${state.substring(0, 20)}...`);

    return NextResponse.redirect(fbAuthUrl.toString());

  } catch (error) {
    console.error('❌ Error initiating additional Facebook connection:', error);
    return NextResponse.redirect(
      `${process.env.NEXTAUTH_URL}/dashboard/accounts?error=connection_failed`
    );
  }
}