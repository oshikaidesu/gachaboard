import { type NextAuthOptions } from "next-auth";
import NextAuth from "next-auth";
import DiscordProvider from "next-auth/providers/discord";
import { db } from "@/lib/db";

export const authOptions: NextAuthOptions = {
  secret: process.env.NEXTAUTH_SECRET,
  trustHost: true,
  session: { strategy: "jwt" },
  providers: [
    DiscordProvider({
      clientId: process.env.DISCORD_CLIENT_ID ?? "",
      clientSecret: process.env.DISCORD_CLIENT_SECRET ?? "",
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
    error: "/auth-error",
  },
};

export default NextAuth(authOptions);
