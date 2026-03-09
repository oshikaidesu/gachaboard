import { withAuth } from "next-auth/middleware";
import { env } from "@/lib/env";

export default withAuth({
  callbacks: {
    authorized: ({ req, token }) => {
      const isE2eMode = env.E2E_TEST_MODE;
      if (isE2eMode && req.nextUrl.pathname.startsWith("/board/")) {
        const testUserId = req.nextUrl.searchParams.get("testUserId");
        const testUserName = req.nextUrl.searchParams.get("testUserName");
        if (testUserId && testUserName) return true;
      }
      return !!token;
    },
  },
  pages: {
    signIn: "/auth/signin",
  },
});

export const config = {
  matcher: ["/workspaces", "/workspaces/:path*", "/workspace/:path*", "/board/:path*", "/assets/:path*"],
};
