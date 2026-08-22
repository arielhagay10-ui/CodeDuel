import type { NextAuthOptions } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import GitHub from "next-auth/providers/github";
import Google from "next-auth/providers/google";

import { getDb } from "@/lib/db";

type OAuthProfile = { email?: string | null };

async function ensureOAuthUser(provider: "google" | "github", providerAccountId: string, profile: OAuthProfile) {
  const client = await getDb().connect();

  try {
    await client.query("BEGIN");
    const existing = await client.query<{ user_id: string }>(
      "SELECT user_id FROM auth_accounts WHERE provider = $1 AND provider_account_id = $2",
      [provider, providerAccountId],
    );

    if (existing.rowCount) {
      await client.query("COMMIT");
      return existing.rows[0].user_id;
    }

    const user = await client.query<{ id: string }>(
      "INSERT INTO users (id) VALUES ($1) RETURNING id",
      [crypto.randomUUID()],
    );
    const userId = user.rows[0].id;
    await client.query(
      "INSERT INTO auth_accounts (id, user_id, provider, provider_account_id, email) VALUES ($1, $2, $3, $4, $5)",
      [crypto.randomUUID(), userId, provider, providerAccountId, profile.email ?? null],
    );
    await client.query("COMMIT");
    return userId;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

/** Local development only. Creates a fully ranked-eligible player from a handle. */
async function ensureDevUser(handle: string) {
  const client = await getDb().connect();

  try {
    await client.query("BEGIN");
    const existing = await client.query<{ id: string }>(
      "SELECT id FROM users WHERE lower(handle) = lower($1)",
      [handle],
    );

    if (existing.rowCount) {
      await client.query("COMMIT");
      return existing.rows[0].id;
    }

    const userId = crypto.randomUUID();
    await client.query(
      "INSERT INTO users (id, handle, ranked_access_granted_at, fair_play_accepted_at) VALUES ($1, $2, now(), now())",
      [userId, handle],
    );
    await client.query(
      `INSERT INTO user_difficulty_ratings (user_id, difficulty, placement_matches_completed, visible_tier, visible_division)
       VALUES ($1, 'easy', 5, 'Bronze', 'II'), ($1, 'medium', 5, 'Silver', 'II'), ($1, 'advanced', 5, 'Bronze', 'III')`,
      [userId],
    );
    await client.query("COMMIT");
    return userId;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

const devProviders =
  process.env.NODE_ENV === "production"
    ? []
    : [
        Credentials({
          id: "dev",
          name: "Dev login",
          credentials: { handle: { label: "Handle", type: "text" } },
          async authorize(credentials) {
            const handle = credentials?.handle?.trim();
            if (!handle || !/^[A-Za-z0-9_]{3,24}$/.test(handle)) return null;
            const id = await ensureDevUser(handle);
            return { id, name: handle };
          },
        }),
      ];

export const authOptions: NextAuthOptions = {
  secret: process.env.AUTH_SECRET,
  session: { strategy: "jwt" },
  providers: [
    Google({ clientId: process.env.AUTH_GOOGLE_ID ?? "", clientSecret: process.env.AUTH_GOOGLE_SECRET ?? "" }),
    GitHub({ clientId: process.env.AUTH_GITHUB_ID ?? "", clientSecret: process.env.AUTH_GITHUB_SECRET ?? "" }),
    ...devProviders,
  ],
  pages: { signIn: "/sign-in" },
  callbacks: {
    async signIn({ account, profile }) {
      if (account?.provider === "dev") return process.env.NODE_ENV !== "production";
      if (!account || (account.provider !== "google" && account.provider !== "github")) return false;
      await ensureOAuthUser(account.provider, account.providerAccountId, profile ?? {});
      return true;
    },
    async jwt({ token, account, user }) {
      if (user?.id) token.userId = user.id;
      if (account && (account.provider === "google" || account.provider === "github")) {
        const result = await getDb().query<{ user_id: string }>(
          "SELECT user_id FROM auth_accounts WHERE provider = $1 AND provider_account_id = $2",
          [account.provider, account.providerAccountId],
        );
        token.userId = result.rows[0]?.user_id;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user && typeof token.userId === "string") session.user.id = token.userId;
      return session;
    },
  },
};
