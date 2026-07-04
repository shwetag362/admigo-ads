import { JWT } from 'next-auth/jwt';

const SESSION_MAX_AGE = 30 * 24 * 60 * 60; // 30 days

export async function createSession(token) {
  const expires = new Date(Date.now() + SESSION_MAX_AGE * 1000);
  return {
    sessionToken: crypto.randomUUID(),
    userId: token.sub,
    expiresAt: expires,
  };
}

export function isSessionValid(session) {
  if (!session || !session.expiresAt) return false;
  return new Date(session.expiresAt) > new Date();
}