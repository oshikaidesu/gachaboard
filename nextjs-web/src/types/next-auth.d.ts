import { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      discordId: string;
      name: string;
      avatarUrl: string | null;
      /** ワークスペース一覧（/workspaces）にアクセス可能か。SERVER_OWNER_DISCORD_ID 未設定時は true、設定時はサーバーオーナーのみ true */
      canAccessWorkspaceList?: boolean;
    } & Omit<DefaultSession["user"], "email" | "image">;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    discordId?: string;
    discordName?: string;
    avatarUrl?: string | null;
    canAccessWorkspaceList?: boolean;
  }
}
