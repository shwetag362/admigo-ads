// lib/auth/options.js
// NextAuth configuration (providers, callbacks, cookies). Lives in lib/ because
// it is auth infrastructure/config — not a route. The route file
// (app/api/auth/[...nextauth]/route.js) imports this and constructs the handler,
// and re-exports `authOptions` for backward compatibility.
import FacebookProvider from "next-auth/providers/facebook";
import GoogleProvider from "next-auth/providers/google";
import CredentialsProvider from "next-auth/providers/credentials";
import { prisma } from "@/lib/prisma";
import { verifyPassword } from "@/lib/auth/password";
import { rateLimit } from "@/lib/rate-limit";

export const authOptions = {
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    }),

    FacebookProvider({
      clientId: process.env.FACEBOOK_CLIENT_ID,
      clientSecret: process.env.FACEBOOK_CLIENT_SECRET,
      version: "v24.0",
      authorization: {
        params: {
          scope: [
            'email',
            'public_profile',
            'ads_management',
            'ads_read',
            'business_management',
            'pages_show_list',
            'pages_read_engagement',
            'instagram_basic',
            'pages_manage_ads',
          ].join(','),
        },
      },
    }),

    CredentialsProvider({
      name: 'credentials',
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" }
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          throw new Error('Please enter email and password');
        }

        // Throttle password attempts per-email to blunt brute force.
        const rl = await rateLimit(`login:${credentials.email.toLowerCase()}`, {
          limit: 10,
          windowSec: 300,
        });
        if (!rl.allowed) {
          throw new Error('Too many attempts. Please try again in a few minutes.');
        }

        const user = await prisma.user.findUnique({
          where: { email: credentials.email },
          select: {
            id: true,
            email: true,
            name: true,
            passwordHash: true,
            avatarUrl: true,
            role: true,          // ✅ NEW: fetch role
          }
        });

        if (!user || !user.passwordHash) {
          throw new Error('Invalid email or password');
        }

        const isValidPassword = await verifyPassword(
          credentials.password,
          user.passwordHash
        );

        if (!isValidPassword) {
          throw new Error('Invalid email or password');
        }

        console.log(`✅ SUCCESS: ${user.email} | role: ${user.role}`);

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          image: user.avatarUrl,
          role: user.role,       // ✅ NEW: pass role to JWT
        };
      }
    }),
  ],

  secret: process.env.NEXTAUTH_SECRET,
  session: {
    strategy: "jwt",
    maxAge: 60 * 24 * 60 * 60, // 60 days
  },

  cookies: {
    sessionToken: {
      name: "authjs.session-token",
      options: {
        httpOnly: true,
        sameSite: "lax",
        path: "/",
        secure: process.env.NODE_ENV === "production",
      },
    },
  },

  callbacks: {
    async signIn({ user, account, profile }) {
      console.log('\n========================================');
      console.log('🚀 SIGN IN CALLBACK START');
      console.log(`🔑 Provider: ${account?.provider}`);
      console.log('========================================\n');

      // ─── GOOGLE OAUTH FLOW ──────────────────────────────────────────────
      // Persist/find the user by email (no DB adapter, so we do it here) and
      // set id/role so the jwt/session callbacks pick them up.
      if (account?.provider === "google") {
        try {
          const email = user.email || profile?.email;
          if (!email) return false;
          const dbUser = await prisma.user.upsert({
            where: { email },
            update: {
              name: user.name || profile?.name,
              avatarUrl: user.image || profile?.picture,
            },
            create: {
              email,
              name: user.name || profile?.name,
              avatarUrl: user.image || profile?.picture,
              emailVerified: true,
              role: "user",
            },
            select: { id: true, role: true },
          });
          user.id = dbUser.id;
          user.role = dbUser.role;
          console.log(`✅ Google sign-in | ${email} | role: ${dbUser.role}`);
          return true;
        } catch (error) {
          console.error("💥 GOOGLE SIGN IN ERROR:", error?.message);
          return false;
        }
      }

      // ─── FACEBOOK OAUTH FLOW ────────────────────────────────────────────
      if (account?.provider === "facebook") {
        try {
          // STEP 1: Exchange short-lived token for long-lived token
          console.log('📍 STEP 1: Token Exchange');
          const longLivedParams = new URLSearchParams({
            grant_type: 'fb_exchange_token',
            client_id: process.env.FACEBOOK_CLIENT_ID,
            client_secret: process.env.FACEBOOK_CLIENT_SECRET,
            fb_exchange_token: account.access_token,
          });

          const longLivedResponse = await fetch(
            `https://graph.facebook.com/v24.0/oauth/access_token?${longLivedParams}`
          );

          let finalToken = account.access_token;
          let expiresIn = 5184000;

          if (longLivedResponse.ok) {
            const longLivedData = await longLivedResponse.json();
            finalToken = longLivedData.access_token || finalToken;
            expiresIn = longLivedData.expires_in || expiresIn;
            console.log(`✅ Long-lived token obtained (${Math.floor(expiresIn / 86400)} days)`);
          } else {
            console.warn('⚠️  Token exchange failed, using short-lived token');
          }

          const tokenExpiresAt = new Date(Date.now() + expiresIn * 1000);

          // STEP 2: Fetch email if missing
          console.log('📍 STEP 2: User Profile');
          let userEmail = user.email;
          if (!userEmail) {
            try {
              const profileResponse = await fetch(
                `https://graph.facebook.com/v24.0/me?fields=email&access_token=${finalToken}`
              );
              if (profileResponse.ok) {
                const profileData = await profileResponse.json();
                userEmail = profileData.email;
              }
            } catch (e) {
              console.warn('⚠️  Could not fetch email:', e.message);
            }
          }

          // STEP 3: Fetch ad accounts
          console.log('📍 STEP 3: Ad Accounts');
          const adAccountsResponse = await fetch(
            `https://graph.facebook.com/v24.0/me/adaccounts?fields=id,name,account_id,account_status,currency,timezone_name,business&access_token=${finalToken}`
          );
          let adAccounts = [];
          if (adAccountsResponse.ok) {
            const adAccountsData = await adAccountsResponse.json();
            adAccounts = adAccountsData.data || [];
            console.log(`✅ Found ${adAccounts.length} ad account(s)`);
          }

          // STEP 4: Get or create user + OAuth account
          console.log('📍 STEP 4: Database — User & OAuth');
          let dbUser;

          try {
            const existingOAuthAccount = await prisma.oAuthAccount.findUnique({
              where: {
                provider_providerAccountId: {
                  provider: 'facebook',
                  providerAccountId: account.providerAccountId,
                },
              },
              include: {
                user: {
                  select: {
                    id: true,
                    email: true,
                    name: true,
                    avatarUrl: true,
                    emailVerified: true,
                    role: true,        // ✅ NEW: include role
                  }
                }
              }
            });

            if (existingOAuthAccount) {
              dbUser = existingOAuthAccount.user;
              console.log(`✅ Existing user found | role: ${dbUser.role}`);

              await prisma.oAuthAccount.update({
                where: { id: existingOAuthAccount.id },
                data: {
                  accessToken: finalToken,
                  refreshToken: account.refresh_token || null,
                  expiresAt: tokenExpiresAt,
                },
              });

              const needsProfileUpdate =
                (user.name && user.name !== dbUser.name) ||
                (user.image && user.image !== dbUser.avatarUrl);

              if (needsProfileUpdate) {
                dbUser = await prisma.user.update({
                  where: { id: dbUser.id },
                  data: {
                    name: user.name || dbUser.name,
                    avatarUrl: user.image || dbUser.avatarUrl,
                  },
                });
              }

            } else {
              console.log('ℹ️  No existing OAuth account — creating user');
              const userEmailToUse = userEmail || `facebook_${account.providerAccountId}@temp.com`;

              dbUser = await prisma.user.upsert({
                where: { email: userEmailToUse },
                update: {
                  name: user.name || profile?.name,
                  avatarUrl: user.image || profile?.picture?.data?.url,
                  oauthAccounts: {
                    create: {
                      provider: 'facebook',
                      providerAccountId: account.providerAccountId,
                      accessToken: finalToken,
                      refreshToken: account.refresh_token || null,
                      expiresAt: tokenExpiresAt,
                    },
                  },
                },
                create: {
                  email: userEmailToUse,
                  name: user.name || profile?.name,
                  avatarUrl: user.image || profile?.picture?.data?.url,
                  emailVerified: !!userEmail,
                  role: 'user',        // ✅ NEW: default role on creation
                  oauthAccounts: {
                    create: {
                      provider: 'facebook',
                      providerAccountId: account.providerAccountId,
                      accessToken: finalToken,
                      refreshToken: account.refresh_token || null,
                      expiresAt: tokenExpiresAt,
                    },
                  },
                },
              });

              console.log(`✅ User created | ID: ${dbUser.id}`);
            }

            // ✅ NEW: always fetch fresh role from DB (covers manual promotions)
            const freshUser = await prisma.user.findUnique({
              where: { id: dbUser.id },
              select: { role: true },
            });
            user.role = freshUser?.role ?? 'user';
            console.log(`🔐 Role resolved: ${user.role}`);

            // STEP 5: Create/update FacebookAccount
            console.log('📍 STEP 5: Facebook Account');
            const existingThisFbAccount = await prisma.facebookAccount.findUnique({
              where: {
                userId_facebookUserId: {
                  userId: dbUser.id,
                  facebookUserId: account.providerAccountId,
                },
              },
            });

            const otherFbAccountsCount = await prisma.facebookAccount.count({
              where: {
                userId: dbUser.id,
                id: { not: existingThisFbAccount?.id },
                isActive: true,
              },
            });

            const isPrimaryAccount = existingThisFbAccount
              ? existingThisFbAccount.isPrimary
              : otherFbAccountsCount === 0;

            const facebookAccount = await prisma.facebookAccount.upsert({
              where: {
                userId_facebookUserId: {
                  userId: dbUser.id,
                  facebookUserId: account.providerAccountId,
                },
              },
              update: {
                facebookUserName: user.name || profile?.name,
                accessToken: finalToken,
                refreshToken: account.refresh_token || null,
                tokenExpiresAt: tokenExpiresAt,
                isActive: true,
                isPrimary: isPrimaryAccount,
                updatedAt: new Date(),
              },
              create: {
                userId: dbUser.id,
                facebookUserId: account.providerAccountId,
                facebookUserName: user.name || profile?.name,
                accessToken: finalToken,
                refreshToken: account.refresh_token || null,
                tokenExpiresAt: tokenExpiresAt,
                isActive: true,
                isPrimary: isPrimaryAccount,
              },
            });

            console.log(`✅ Facebook account saved | isPrimary: ${facebookAccount.isPrimary}`);

            // STEP 6: Save ad accounts
            console.log(`📍 STEP 6: Ad Accounts (${adAccounts.length})`);
            let savedCount = 0;

            for (const adAccount of adAccounts) {
              try {
                const businessName = adAccount.business?.name || null;
                const existingAdAccount = await prisma.metaAdAccount.findFirst({
                  where: {
                    facebookAccountId: facebookAccount.id,
                    metaAccountId: adAccount.id,
                  },
                });

                if (existingAdAccount) {
                  await prisma.metaAdAccount.update({
                    where: { id: existingAdAccount.id },
                    data: {
                      name: adAccount.name,
                      currency: adAccount.currency,
                      timezone: adAccount.timezone_name,
                      businessName,
                      accessToken: finalToken,
                      updatedAt: new Date(),
                    },
                  });
                } else {
                  await prisma.metaAdAccount.create({
                    data: {
                      userId: dbUser.id,
                      facebookAccountId: facebookAccount.id,
                      metaAccountId: adAccount.id,
                      name: adAccount.name,
                      currency: adAccount.currency,
                      timezone: adAccount.timezone_name,
                      businessName,
                      accessToken: finalToken,
                    },
                  });
                }
                savedCount++;
              } catch (adError) {
                console.error(`❌ Failed to save ad account: ${adError.message}`);
              }
            }

            console.log(`✅ Ad accounts saved: ${savedCount}/${adAccounts.length}`);

            // Set user.id for JWT callback
            user.id = dbUser.id;

          } catch (dbError) {
            console.error('❌ DATABASE ERROR:', dbError.message);

            // Recovery attempt
            try {
              const recoveredOAuth = await prisma.oAuthAccount.findUnique({
                where: {
                  provider_providerAccountId: {
                    provider: 'facebook',
                    providerAccountId: account.providerAccountId,
                  },
                },
                select: { userId: true }
              });

              if (recoveredOAuth) {
                user.id = recoveredOAuth.userId;

                // ✅ NEW: recover role too
                const recoveredUser = await prisma.user.findUnique({
                  where: { id: recoveredOAuth.userId },
                  select: { role: true },
                });
                user.role = recoveredUser?.role ?? 'user';
                console.log(`✅ Recovered user ID: ${user.id} | role: ${user.role}`);
              } else {
                console.error('❌ Cannot recover — rejecting sign-in');
                return false;
              }
            } catch (recoveryError) {
              console.error('❌ Recovery failed:', recoveryError.message);
              return false;
            }
          }

          account.longLivedToken = finalToken;
          account.tokenExpiresAt = Date.now() + expiresIn * 1000;
          account.email = userEmail;
          account.adAccountsCount = adAccounts.length;

          console.log('✅ FACEBOOK SIGN IN COMPLETE\n');
          return true;

        } catch (error) {
          console.error('💥 FATAL ERROR IN FACEBOOK SIGN IN:', error.message);
          return false;
        }
      }

      // ─── CREDENTIALS FLOW ───────────────────────────────────────────────
      if (account?.provider === "credentials") {
        console.log('✅ Credentials sign-in approved');
        return true;
      }

      console.warn(`⚠️  Unknown provider: ${account?.provider}`);
      return true;
    },

    async jwt({ token, user, account, trigger }) {
      // ─── FACEBOOK: initial sign-in ───────────────────────────────────
      if (account?.provider === "facebook") {
        token.accessToken    = account.longLivedToken || account.access_token;
        token.tokenExpiresAt = account.tokenExpiresAt;
        token.facebookId     = account.providerAccountId;
        token.email          = account.email || user.email || null;
        token.adAccountsCount = account.adAccountsCount || 0;
        token.provider       = "facebook";
      }

      // ─── CREDENTIALS: initial sign-in ───────────────────────────────
      if (account?.provider === "credentials") {
        token.provider = "credentials";
      }

      // ─── BOTH: persist id + role on first sign-in ───────────────────
      if (user?.id) {
        token.id   = user.id;
        token.role = user.role ?? "user";   // ✅ NEW
      }

      return token;
    },

    async session({ session, token }) {
      // Core fields
      session.user.id    = token.id || token.sub;
      session.user.email = token.email || session.user.email || null;
      session.user.role  = token.role ?? "user";   // ✅ NEW
      session.provider   = token.provider;

      // Facebook-specific
      if (token.provider === "facebook") {
        session.user.facebookId  = token.facebookId;
        session.accessToken      = token.accessToken;
        session.tokenExpiresAt   = token.tokenExpiresAt;
        session.adAccountsCount  = token.adAccountsCount || 0;
      }

      return session;
    },
  },

  pages: {
    signIn:  '/login',
    error:   '/login',
    signOut: '/login',
  },

  events: {
    async signIn({ user, account }) {
      console.log(`🎉 SIGNED IN | ${user.email} | ${account?.provider} | role: ${user.role}`);
    },
    async signOut({ token }) {
      console.log(`👋 SIGNED OUT | ${token?.id} | ${token?.provider}`);
    },
  },

  logger: {
    error(code, metadata) {
      console.error(`🚨 NEXTAUTH ERROR [${code}]`, metadata);
    },
    warn(code) {
      console.warn(`⚠️  NEXTAUTH WARNING [${code}]`);
    },
  },
};
