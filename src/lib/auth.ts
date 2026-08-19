import type { NextAuthOptions } from "next-auth";
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

export const authOptions: NextAuthOptions = {
  secret: process.env.AUTH_SECRET,
  session: { strategy: "jwt" },
  providers: [
    Google({ clientId: process.env.AUTH_GOOGLE_ID ?? "", clientSecret: process.env.AUTH_GOOGLE_SECRET ?? "" }),
    GitHub({ clientId: process.env.AUTH_GITHUB_ID ?? "", clientSecret: process.env.AUTH_GITHUB_SECRET ?? "" }),
  ],
  pages: { signIn: "/sign-in" },
  callbacks: {
    async signIn({ account, profile }) {
      if (!account || (account.provider !== "google" && account.provider !== "github")) return false;
      await ensureOAuthUser(account.provider, account.providerAccountId, profile ?? {});
      return true;
    },
    async jwt({ token, account }) {
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
