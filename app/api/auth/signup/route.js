// app/api/auth/signup/route.js
import { prisma } from "@/lib/prisma";
import { hashPassword } from "@/lib/auth/password";
import { rateLimit, clientIp } from "@/lib/rate-limit";
import { NextResponse } from "next/server";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(req) {
  // Throttle account creation per IP to blunt abuse/enumeration.
  const ip = clientIp(req.headers);
  const rl = await rateLimit(`signup:${ip}`, { limit: 5, windowSec: 600 });
  if (!rl.allowed) {
    return NextResponse.json(
      { error: "Too many attempts. Please try again later." },
      { status: 429, headers: { "Retry-After": String(rl.retryAfter) } }
    );
  }

  try {
    const { name, email, password } = await req.json();

    if (!email || !password) {
      return NextResponse.json({ error: "Email and password required" }, { status: 400 });
    }
    if (!EMAIL_RE.test(email)) {
      return NextResponse.json({ error: "Invalid email format" }, { status: 400 });
    }
    if (password.length < 8) {
      return NextResponse.json(
        { error: "Password must be at least 8 characters" },
        { status: 400 }
      );
    }

    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      return NextResponse.json({ error: "User already exists" }, { status: 409 });
    }

    const passwordHash = await hashPassword(password);

    const newUser = await prisma.user.create({
      data: { email, name: name?.trim() || null, passwordHash },
      select: { id: true, email: true, name: true },
    });

    // Client completes login via NextAuth signIn("credentials").
    return NextResponse.json(
      {
        success: true,
        message: "Account created successfully",
        user: { id: newUser.id, email: newUser.email, name: newUser.name },
      },
      { status: 201 }
    );
  } catch (error) {
    // Log server-side; never leak error internals to the client.
    console.error("[signup] error:", error);

    if (error?.code === "P2002") {
      return NextResponse.json({ error: "Email already exists" }, { status: 409 });
    }
    return NextResponse.json({ error: "Failed to create account" }, { status: 500 });
  }
}
