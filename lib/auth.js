// src/lib/auth.js
import { getServerSession } from 'next-auth';
import { authOptions } from '@/auth/options'; // or wherever your options are

// Re-export so getServerSession works in API routes
export { getServerSession, authOptions };