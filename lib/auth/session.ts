// lib/auth/session.ts — typed session accessor.
// Centralizes the getServerSession(authOptions) call. authOptions lives in a .js
// module, so it's cast to the typed AuthOptions shape here (one place, not every route).
import { getServerSession, type AuthOptions } from "next-auth";
import { authOptions } from "@/lib/auth/options";

export function getSession() {
  return getServerSession(authOptions as unknown as AuthOptions);
}
