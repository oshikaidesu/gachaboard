import { PrismaAdapter } from "@auth/prisma-adapter";
import { type NextAuthOptions } from "next-auth";
import NextAuth from "next-auth";
import DiscordProvider from "next-auth/providers/discord";
import { db } from "@/lib/db";

export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(db),
  secret: process.env.NEXTAUTH_SECRET,
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
        const p = profile as { id: string; username: string; global_name?: string };
        token.discordId = p.id;
        // global_name は Discord の表示名、なければ username（識別子）を使う
        token.discordName = p.global_name ?? p.username;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.sub ?? "";
        session.user.discordId = (token.discordId as string | undefined) ?? "";
        // Discord 表示名を name に上書き
        if (token.discordName) {
          session.user.name = token.discordName as string;
        }
      }
      return session;
    },
  },
  pages: {
    signIn: "/",
    error: "/auth-error",
  },
};

export default NextAuth(authOptions);
