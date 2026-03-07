import { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      discordId: string;
      name: string;
      avatarUrl: string | null;
    } & Omit<DefaultSession["user"], "email" | "image">;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    discordId?: string;
    discordName?: string;
    avatarUrl?: string | null;
  }
}
