// types/next-auth.d.ts — augment NextAuth types with our custom fields.
// We attach `id` + `role` to the session/JWT via callbacks; declare them here
// so TypeScript knows about them everywhere.
import type { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    user?: {
      id?: string | null;
      role?: string | null;
      facebookId?: string | null;
    } & DefaultSession["user"];
    provider?: string;
    accessToken?: string;
    tokenExpiresAt?: number;
    adAccountsCount?: number;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id?: string;
    role?: string;
    provider?: string;
    accessToken?: string;
    facebookId?: string;
  }
}
