import type { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { db } from "@/lib/db";
import { comparePassword, isHashed, hashPassword } from "@/lib/password";

/**
 * Token version for session invalidation.
 * Increment this value to force ALL existing sessions to re-authenticate.
 * Use case: security incidents, major deployments, policy changes.
 */
const AUTH_TOKEN_VERSION = 1;

const isProduction = process.env.NODE_ENV === "production";

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Contraseña", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          return null;
        }

        const user = await db.user.findUnique({
          where: { email: credentials.email },
        });

        if (!user || !user.active) {
          return null;
        }

        // Secure password comparison using bcrypt
        // Supports both hashed and plaintext passwords for migration period
        let isValid = false;
        if (isHashed(user.password)) {
          isValid = await comparePassword(credentials.password, user.password);
        } else {
          // Legacy plaintext comparison (will be removed after migration)
          isValid = user.password === credentials.password;
          // Auto-upgrade plaintext to bcrypt on successful login
          if (isValid) {
            const hashedPassword = await hashPassword(credentials.password);
            await db.user.update({
              where: { id: user.id },
              data: { password: hashedPassword },
            });
          }
        }
        if (!isValid) {
          return null;
        }

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user, trigger }) {
      // Stamp token version on initial sign-in
      if (user) {
        token.role = (user as { role: string }).role;
        token.id = user.id;
        token.tokenVersion = AUTH_TOKEN_VERSION;
      }

      // Reject tokens from a previous token version (forces re-login)
      if (token.tokenVersion !== AUTH_TOKEN_VERSION) {
        return {} as any; // Returning empty object invalidates the session
      }

      // When session is updated (e.g. user changed email/name), refresh from DB
      if (trigger === "update" && token.id) {
        try {
          const dbUser = await db.user.findUnique({
            where: { id: token.id as string },
            select: { id: true, name: true, email: true, role: true, active: true },
          });
          if (!dbUser || !dbUser.active) {
            // User was deactivated — invalidate session immediately
            return {} as any;
          }
          token.email = dbUser.email;
          token.name = dbUser.name;
          token.role = dbUser.role;
          token.tokenVersion = AUTH_TOKEN_VERSION;
        } catch {
          // If DB fetch fails, keep existing token data
        }
      }
      return token;
    },
    async session({ session, token }) {
      // If token was invalidated (empty object), return null to force logout
      if (!token || !token.id) {
        return null as any;
      }
      if (session.user) {
        (session.user as { role: string }).role = token.role as string;
        (session.user as { id: string }).id = token.id as string;
      }
      return session;
    },
  },
  pages: {
    signIn: "/",
  },
  session: {
    strategy: "jwt",
    maxAge: 24 * 60 * 60, // 24 hours in seconds — strict session lifetime
    updateAge: 4 * 60 * 60, // Rolling session: re-issue JWT every 4 hours if active
  },
  cookies: {
    sessionToken: {
      name: `${isProduction ? "__Secure-" : ""}next-auth.session-token`,
      options: {
        httpOnly: true,
        sameSite: "lax",
        path: "/",
        secure: isProduction,
      },
    },
    callbackUrl: {
      name: `${isProduction ? "__Secure-" : ""}next-auth.callback-url`,
      options: {
        httpOnly: true,
        sameSite: "lax",
        path: "/",
        secure: isProduction,
      },
    },
    csrfToken: {
      name: `${isProduction ? "__Host-" : ""}next-auth.csrf-token`,
      options: {
        httpOnly: true,
        sameSite: "lax",
        path: "/",
        secure: isProduction,
      },
    },
  },
  secret: process.env.NEXTAUTH_SECRET,
  debug: false,
};
