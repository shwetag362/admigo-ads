import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const code = searchParams.get('code');
    const state = searchParams.get('state');
    const error = searchParams.get('error');
    const errorDescription = searchParams.get('error_description');

    console.log('📥 Callback received:', { code: code ? 'present' : 'missing', state, error });

    // Handle user denial or errors from Facebook
    if (error) {
      console.error('Facebook OAuth error:', error, errorDescription);
      return NextResponse.redirect(
        `${process.env.NEXT_PUBLIC_URL}/login?error=access_denied&message=${encodeURIComponent(errorDescription || 'Access denied')}`
      );
    }

    // Validate required parameters
    if (!code || !state) {
      console.error('Missing code or state');
      return NextResponse.redirect(
        `${process.env.NEXT_PUBLIC_URL}/login?error=invalid_request`
      );
    }

    // Verify state for CSRF protection (fixed cookies API usage)
    let storedState = null;
    try {
      const cookieStore = cookies();
      const stateCookie = cookieStore.get('oauth_state');
      storedState = stateCookie?.value;
      
      console.log('State verification:', { stored: storedState, received: state });
      
      if (!storedState || storedState !== state) {
        console.error('State mismatch - possible CSRF attack');
        return NextResponse.redirect(
          `${process.env.NEXT_PUBLIC_URL}/login?error=invalid_state`
        );
      }

      // Clear the state cookie
      cookieStore.delete('oauth_state');
    } catch (cookieError) {
      console.warn('Cookie verification skipped:', cookieError.message);
      // Continue without state verification for now
    }

    console.log('✅ Exchanging code for token...');

    // Exchange code for access token
    const tokenParams = new URLSearchParams({
      client_id: process.env.FACEBOOK_CLIENT_ID,
      client_secret: process.env.FACEBOOK_CLIENT_SECRET,
      redirect_uri: `${process.env.NEXT_PUBLIC_URL}/api/auth/facebook/callback`,
      code: code,
    });

    const tokenResponse = await fetch(
      `https://graph.facebook.com/v21.0/oauth/access_token?${tokenParams}`,
      { method: 'GET' }
    );

    if (!tokenResponse.ok) {
      const errorData = await tokenResponse.json();
      console.error('Token exchange failed:', errorData);
      return NextResponse.redirect(
        `${process.env.NEXT_PUBLIC_URL}/login?error=token_exchange_failed`
      );
    }

    const tokenData = await tokenResponse.json();
    const { access_token, expires_in } = tokenData;

    console.log('✅ Token received, getting long-lived token...');

    // Get long-lived token (60 days)
    const longLivedParams = new URLSearchParams({
      grant_type: 'fb_exchange_token',
      client_id: process.env.FACEBOOK_CLIENT_ID,
      client_secret: process.env.FACEBOOK_CLIENT_SECRET,
      fb_exchange_token: access_token,
    });

    const longLivedResponse = await fetch(
      `https://graph.facebook.com/v21.0/oauth/access_token?${longLivedParams}`,
      { method: 'GET' }
    );

    let finalToken = access_token;
    let finalExpiresIn = expires_in;

    if (longLivedResponse.ok) {
      const longLivedData = await longLivedResponse.json();
      finalToken = longLivedData.access_token;
      finalExpiresIn = longLivedData.expires_in;
      console.log('✅ Long-lived token obtained');
    }

    // Get user info
    console.log('✅ Fetching user info...');
    const userResponse = await fetch(
      `https://graph.facebook.com/v21.0/me?fields=id,name,email&access_token=${finalToken}`
    );

    if (!userResponse.ok) {
      console.error('Failed to fetch user info');
      return NextResponse.redirect(
        `${process.env.NEXT_PUBLIC_URL}/login?error=user_info_failed`
      );
    }

    const userData = await userResponse.json();
    console.log('✅ User info received:', userData.id, userData.name);

    // Get ad accounts
    console.log('✅ Fetching ad accounts...');
    const adAccountsResponse = await fetch(
      `https://graph.facebook.com/v21.0/me/adaccounts?fields=id,name,account_id,account_status,currency,timezone_name&access_token=${finalToken}`
    );

    let adAccounts = [];
    if (adAccountsResponse.ok) {
      const adAccountsData = await adAccountsResponse.json();
      adAccounts = adAccountsData.data || [];
      console.log(`✅ Found ${adAccounts.length} ad accounts`);
    }

    // Get business accounts
    console.log('✅ Fetching business accounts...');
    const businessResponse = await fetch(
      `https://graph.facebook.com/v21.0/me/businesses?fields=id,name&access_token=${finalToken}`
    );

    let businesses = [];
    if (businessResponse.ok) {
      const businessData = await businessResponse.json();
      businesses = businessData.data || [];
      console.log(`✅ Found ${businesses.length} businesses`);
    }

    // TODO: Store this data in your database
    const dataToStore = {
      user: {
        facebookId: userData.id,
        name: userData.name,
        email: userData.email,
      },
      token: {
        accessToken: finalToken,
        expiresIn: finalExpiresIn,
        expiresAt: new Date(Date.now() + finalExpiresIn * 1000),
      },
      adAccounts: adAccounts,
      businesses: businesses,
    };

    console.log('✅ Facebook OAuth successful - TODO: Save to database');
    console.log('Data to store:', JSON.stringify(dataToStore, null, 2));

    // Store in database here
    // await prisma.facebookAccount.create({ data: dataToStore });

    // Redirect to success page
    return NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_URL}/login?success=true&accounts=${adAccounts.length}`
    );

  } catch (error) {
    console.error('❌ Facebook OAuth callback error:', error);
    console.error('Error stack:', error.stack);
    return NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_URL}/login?error=callback_failed`
    );
  }
}