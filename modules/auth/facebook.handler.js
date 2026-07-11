import { NextResponse } from 'next/server';

const SCOPES = [
  'ads_management',
  'business_management',
  'ads_read',
  'read_insights',
  'pages_read_engagement',
  'pages_manage_ads',
  'pages_show_list',
  'instagram_basic',
  'instagram_manage_insights'
].join(',');

export async function GET(request) {
  try {
    // Log environment variables (for debugging)
    console.log('Environment Check:');
    console.log('FACEBOOK_CLIENT_ID:', process.env.FACEBOOK_CLIENT_ID ? '✓ Set' : '✗ Missing');
    console.log('NEXT_PUBLIC_URL:', process.env.NEXT_PUBLIC_URL ? '✓ Set' : '✗ Missing');

    const clientId = process.env.FACEBOOK_CLIENT_ID;
    const baseUrl = process.env.NEXT_PUBLIC_URL;

    if (!clientId) {
      console.error('Missing FACEBOOK_CLIENT_ID');
      return NextResponse.json(
        { error: 'Facebook Client ID not configured' },
        { status: 500 }
      );
    }

    if (!baseUrl) {
      console.error('Missing NEXT_PUBLIC_URL');
      return NextResponse.json(
        { error: 'Base URL not configured' },
        { status: 500 }
      );
    }

    const state = crypto.randomUUID();
    const redirectUri = `${baseUrl}/api/auth/facebook/callback`;

    console.log('Redirect URI:', redirectUri);
    console.log('Client ID:', clientId);

    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUri,
      scope: SCOPES,
      response_type: 'code',
      state: state,
      auth_type: 'rerequest',
    });

    const oauthUrl = `https://www.facebook.com/v24.0/dialog/oauth?${params}`;
    console.log('Redirecting to Facebook OAuth');

    // Store state in URL for now (simpler than cookies)
    const response = NextResponse.redirect(oauthUrl);
    
    // Try to set cookie, but don't fail if it doesn't work
    try {
      response.cookies.set('oauth_state', state, {
        httpOnly: true,
        secure: true,
        sameSite: 'lax',
        maxAge: 600,
        path: '/'
      });
    } catch (cookieError) {
      console.warn('Could not set cookie:', cookieError.message);
    }

    return response;
    
  } catch (error) {
    console.error('Facebook OAuth Error:', error);
    return NextResponse.json(
      { 
        error: 'Failed to initiate Facebook OAuth flow',
        message: error.message 
      },
      { status: 500 }
    );
  }
}