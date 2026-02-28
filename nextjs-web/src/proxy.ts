import { withAuth } from "next-auth/middleware";

export default withAuth({
  callbacks: {
    authorized: ({ req, token }) => {
      const isE2eMode = process.env.E2E_TEST_MODE === "1";
      if (isE2eMode && req.nextUrl.pathname.startsWith("/board/")) {
        const testUserId = req.nextUrl.searchParams.get("testUserId");
        const testUserName = req.nextUrl.searchParams.get("testUserName");
        if (testUserId && testUserName) return true;
      }
      return !!token;
    },
  },
  pages: {
    signIn: "/",
  },
});

export const config = {
  matcher: ["/workspaces", "/workspaces/:path*", "/workspace/:path*", "/board/:path*", "/assets/:path*"],
};
