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
        // === Sanitización de inputs (tarea 2026-08-21) ===
        // Antes de hacer cualquier cosa, sanitizamos el email para evitar
        // problemas de espacios accidentales o mayúsculas/minúsculas.
        const rawEmail = credentials?.email?.trim().toLowerCase() || "";
        const rawPassword = credentials?.password || "";

        if (!rawEmail || !rawPassword) {
          console.log("[auth] Login fallido: email o password vacíos");
          return null;
        }

        try {
          const user = await db.user.findUnique({
            where: { email: rawEmail },
          });

          if (!user) {
            console.log(`[auth] Login fallido: usuario NO encontrado - email="${rawEmail}"`);
            return null;
          }

          if (!user.active) {
            console.log(`[auth] Login fallido: usuario INACTIVO - email="${rawEmail}", role="${user.role}", active=${user.active}`);
            return null;
          }

          // Secure password comparison using bcrypt
          // Supports both hashed and plaintext passwords for migration period
          let isValid = false;
          if (isHashed(user.password)) {
            isValid = await comparePassword(rawPassword, user.password);
          } else {
            // Legacy plaintext comparison (will be removed after migration)
            isValid = user.password === rawPassword;
            // Auto-upgrade plaintext to bcrypt on successful login
            if (isValid) {
              const hashedPassword = await hashPassword(rawPassword);
              await db.user.update({
                where: { id: user.id },
                data: { password: hashedPassword },
              });
            }
          }

          if (!isValid) {
            console.log(`[auth] Login fallido: contraseña incorrecta - email="${rawEmail}", role="${user.role}"`);
            return null;
          }

          console.log(`[auth] ✅ Login exitoso - email="${rawEmail}", role="${user.role}", id="${user.id}"`);

          // === Marcar primer acceso al panel ===
          // hasAccessedPanel se setea en true en el primer login exitoso.
          // Lo hacemos SIN await (fire-and-forget) para no demorar el login.
          // Si falla (DB caída, etc.), el usuario igual entra — el flag se
          // actualizará en el próximo login exitoso.
          if (!user.hasAccessedPanel) {
            db.user.update({
              where: { id: user.id },
              data: { hasAccessedPanel: true },
            }).catch((err) => {
              console.error("[auth] Error marcando hasAccessedPanel:", err);
            });
          }

          return {
            id: user.id,
            email: user.email,
            name: user.name,
            role: user.role,
          };
        } catch (dbError) {
          // === Catch de errores de DB (tarea 2026-08-21) ===
          // Si la DB cae o hay error de conexión, logueamos el error real
          // para poder diagnosticar desde Vercel Logs.
          console.error("[auth] EXCEPCIÓN en authorize (DB error?):", dbError);
          return null;
        }
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
