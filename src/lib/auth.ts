import type { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { db } from "@/lib/db";

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

        // Simple password comparison (in production, use bcrypt)
        if (user.password !== credentials.password) {
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
      if (user) {
        token.role = (user as { role: string }).role;
        token.id = user.id;
      }
      // When session is updated (e.g. user changed email/name), refresh from DB
      if (trigger === "update" && token.id) {
        try {
          const dbUser = await db.user.findUnique({
            where: { id: token.id as string },
            select: { id: true, name: true, email: true, role: true },
          });
          if (dbUser) {
            token.email = dbUser.email;
            token.name = dbUser.name;
            token.role = dbUser.role;
          }
        } catch {
          // If DB fetch fails, keep existing token data
        }
      }
      return token;
    },
    async session({ session, token }) {
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
  },
  secret: process.env.NEXTAUTH_SECRET,
};
