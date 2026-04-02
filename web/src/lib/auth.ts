import { betterAuth } from "better-auth";
import { organization } from "better-auth/plugins";
import { bearer } from "better-auth/plugins";
import { nextCookies } from "better-auth/next-js";
import { Pool } from "pg";

/**
 * Better Auth server config — runs in Next.js API routes.
 *
 * In open source mode (no DATABASE_URL / BETTER_AUTH_SECRET), this file
 * is never imported — the app skips auth entirely.
 *
 * In cloud mode, this powers /api/auth/* endpoints for login, signup,
 * session management, OAuth, and organization management.
 */
export const auth = betterAuth({
  database: new Pool({
    connectionString: process.env.DATABASE_URL,
  }),

  secret: process.env.BETTER_AUTH_SECRET,
  baseURL: process.env.BETTER_AUTH_URL || "http://localhost:3001",

  emailAndPassword: {
    enabled: true,
  },

  socialProviders: {
    ...(process.env.GOOGLE_CLIENT_ID && {
      google: {
        clientId: process.env.GOOGLE_CLIENT_ID!,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
      },
    }),
    ...(process.env.GITHUB_CLIENT_ID && {
      github: {
        clientId: process.env.GITHUB_CLIENT_ID!,
        clientSecret: process.env.GITHUB_CLIENT_SECRET!,
      },
    }),
  },

  session: {
    cookieCache: {
      enabled: true,
      maxAge: 5 * 60, // 5 minutes — FastAPI can verify this JWT directly
    },
  },

  databaseHooks: {
    user: {
      create: {
        after: async (user) => {
          // Auto-create a personal organization on signup using Better Auth's own API.
          // This ensures every user has an org_id from the start.
          try {
            await auth.api.createOrganization({
              body: {
                name: `${user.name || user.email}'s workspace`,
                slug: `personal-${user.id.slice(0, 8)}`,
                userId: user.id,
              },
            });
          } catch (e) {
            // Log but don't fail signup if org creation fails
            console.error("Failed to auto-create personal org:", e);
          }
        },
      },
    },
  },

  plugins: [
    organization({
      allowUserToCreateOrganization: true,
      creatorRole: "owner",
    }),
    bearer(),
    nextCookies(),
  ],
});

export type Session = typeof auth.$Infer.Session;
