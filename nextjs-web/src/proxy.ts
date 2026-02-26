import { withAuth } from "next-auth/middleware";

export const proxy = withAuth({
  pages: {
    signIn: "/",
  },
});

export const config = {
  matcher: ["/workspaces", "/workspaces/:path*", "/workspace/:path*", "/board/:path*", "/assets/:path*"],
};
