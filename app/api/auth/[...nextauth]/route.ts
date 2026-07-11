// app/api/auth/[...nextauth]/route.js — NextAuth handler (thin).
// Config lives in lib/auth/options.js. `authOptions` is re-exported here so
// existing importers of this path keep working; new code should import from
// "@/lib/auth/options" directly.
import NextAuth from "next-auth";
import { authOptions } from "@/lib/auth/options";

const handler = NextAuth(authOptions as never);

export { handler as GET, handler as POST };
export { authOptions };
