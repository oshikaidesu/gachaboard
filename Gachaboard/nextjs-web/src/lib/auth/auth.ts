import { type NextAuthOptions } from "next-auth";
import NextAuth from "next-auth";
import DiscordProvider from "next-auth/providers/discord";
import { db } from "@/lib/db";
import { env } from "@/lib/env";

export const authOptions: NextAuthOptions = {
  secret: env.NEXTAUTH_SECRET,
  // @ts-expect-error v4 型定義に trustHost がないが proxy 配下では必要
  trustHost: true,
  session: { strategy: "jwt" },
  providers: [
    DiscordProvider({
      clientId: env.DISCORD_CLIENT_ID,
      clientSecret: env.DISCORD_CLIENT_SECRET,
      authorization: { params: { scope: "identify" } },
    }),
  ],
  callbacks: {
    async jwt({ token, account, profile }) {
      if (account?.provider === "discord" && profile) {
        const p = profile as { id: string; username: string; global_name?: string; avatar?: string };
        token.discordId = p.id;
        token.discordName = p.global_name ?? p.username;
        token.avatarUrl = p.avatar
          ? `https://cdn.discordapp.com/avatars/${p.id}/${p.avatar}.png`
          : null;

        const user = await db.user.upsert({
          where: { discordId: p.id },
          update: {
            discordName: p.global_name ?? p.username,
            avatarUrl: token.avatarUrl as string | null,
          },
          create: {
            discordId: p.id,
            discordName: p.global_name ?? p.username,
            avatarUrl: token.avatarUrl as string | null,
          },
        });
        token.sub = user.id;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.sub ?? "";
        session.user.discordId = (token.discordId as string | undefined) ?? "";
        if (token.discordName) {
          session.user.name = token.discordName as string;
        }
        session.user.avatarUrl = (token.avatarUrl as string | null) ?? null;
      }
      return session;
    },
  },
  pages: {
    signIn: "/auth/signin",
    error: "/auth-error",
  },
};

export default NextAuth(authOptions);
