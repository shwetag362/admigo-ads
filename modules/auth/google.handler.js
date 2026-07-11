import { NextResponse } from 'next/server';

const GOOGLE_OAUTH_URL = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${process.env.GOOGLE_CLIENT_ID}&redirect_uri=${encodeURIComponent(
  `${process.env.NEXTAUTH_URL}/api/auth/google/callback`
)}&response_type=code&scope=openid%20email%20profile`;

export async function GET() {
  return NextResponse.redirect(GOOGLE_OAUTH_URL);
}