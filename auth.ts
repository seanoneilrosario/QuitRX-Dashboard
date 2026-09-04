import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";

function stringValue(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function objectValue(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? value as Record<string, unknown> : {};
}

export const { auth, handlers, signIn, signOut } = NextAuth({
  secret:
    process.env.AUTH_SECRET ??
    (process.env.NODE_ENV !== "production" ? process.env.QUITHERO_API_KEY : undefined),
  providers: [
    Credentials({
      id: "staff-credentials",
      name: "QuitHero staff",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        const email = stringValue(credentials.email);
        const password = stringValue(credentials.password);
        if (!email || !password) return null;

        const apiBase = (process.env.QUITHERO_API_BASE_URL ?? "https://retail-api.quithero.com.au").replace(/\/$/, "");
        const response = await fetch(`${apiBase}/auth/login`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ email, password }),
          cache: "no-store",
        });
        if (!response.ok) return null;

        const payload = objectValue(await response.json());
        const data = objectValue(payload.data);
        const staff = objectValue(payload.staff ?? payload.user ?? data.staff ?? data.user);
        const accessToken = stringValue(
          payload.accessToken ?? payload.access_token ?? payload.token ??
          data.accessToken ?? data.access_token ?? data.token,
        );
        if (!accessToken) return null;

        return {
          id: stringValue(staff.id) ?? stringValue(payload.id) ?? email,
          email: stringValue(staff.email) ?? email,
          name: stringValue(staff.name) ?? stringValue(staff.fullName) ?? email,
          staffAccessToken: accessToken,
        };
      },
    }),
  ],
  pages: { signIn: "/dashboard/login" },
  session: { strategy: "jwt" },
  callbacks: {
    async jwt({ token, user, account }) {
      if (user) token.id = user.id;
      if (account?.provider === "staff-credentials" && user) {
        const staff = user as typeof user & { staffAccessToken?: string };
        token.isStaff = Boolean(staff.staffAccessToken);
      }
      return token;
    },
    async session({ session, token }) {
      const userId = token.id ?? token.sub;
      if (session.user && typeof userId === "string") {
        session.user.id = userId;
        (session.user as typeof session.user & { isStaff?: boolean }).isStaff = token.isStaff === true;
      }
      return session;
    },
    authorized({ auth: session, request }) {
      if (request.nextUrl.pathname === "/dashboard/login") return true;
      const isStaff = Boolean(
        session?.user &&
        (session.user as typeof session.user & { isStaff?: boolean }).isStaff,
      );
      return isStaff || Response.redirect(new URL("/dashboard/login", request.nextUrl));
    },
  },
});
