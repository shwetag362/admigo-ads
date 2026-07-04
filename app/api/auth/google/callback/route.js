import { prisma } from '@/lib/prisma';
import { SignJWT } from 'jose';
import { NextResponse } from 'next/server';

const secret = new TextEncoder().encode(process.env.NEXTAUTH_SECRET);

export async function GET(req) {
  const url = new URL(req.url);
  const code = url.searchParams.get('code');

  if (!code) return NextResponse.redirect('/signin?error=oauth');

  const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    body: new URLSearchParams({
      code,
      client_id: process.env.GOOGLE_CLIENT_ID,
      client_secret: process.env.GOOGLE_CLIENT_SECRET,
      redirect_uri: `${process.env.NEXTAUTH_URL}/api/auth/google/callback`,
      grant_type: 'authorization_code',
    }),
  });

  const { access_token } = await tokenRes.json();

  const profileRes = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
    headers: { Authorization: `Bearer ${access_token}` },
  });
  const profile = await profileRes.json();

  let user = await prisma.user.findUnique({ where: { email: profile.email } });

  if (!user) {
    user = await prisma.user.create({
      data: { email: profile.email, name: profile.name, emailVerified: true },
    });
  }

  const jwt = await sign({ sub: user.id }, secret, { expiresIn: '30d' });

  const response = NextResponse.redirect('/dashboard');
  response.cookies.set('authjs.session-token', jwt, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 30 * 24 * 60 * 60,
  });

  return response;
}