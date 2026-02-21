import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { AuthOptions } from "next-auth";
import { db } from "@/lib/db";
import GoogleProvider from "next-auth/providers/google";
import { Adapter } from "next-auth/adapters";
import CredentialsProvider from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { prismaAdapter } from "@/lib/auth/prisma-adapter";
import { SessionManager } from "@/lib/session-manager";

export const auth = async () => {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    redirect("/sign-in");
  }

  return {
    userId: session.user.id,
    user: session.user,
  };
};

export const authOptions: AuthOptions = {
  adapter: prismaAdapter(db) as Adapter,
  secret: process.env.NEXTAUTH_SECRET,
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),
    CredentialsProvider({
      name: "credentials",
      credentials: {
        phoneNumber: { label: "Phone Number", type: "text" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.phoneNumber || !credentials?.password) {
          throw new Error("Missing credentials");
        }

        const user = await db.user.findUnique({
          where: {
            phoneNumber: credentials.phoneNumber,
          },
        });

        if (!user || !user.hashedPassword) {
          throw new Error("Invalid credentials");
        }

        const isPasswordValid = await bcrypt.compare(
          credentials.password,
          user.hashedPassword
        );

        if (!isPasswordValid) {
          throw new Error("Invalid credentials");
        }

        // 🔑 KEY CHECK: Prevent login if user is already active (only for regular users)
        // TEACHER and ADMIN can login on multiple devices
        if (user.isActive && user.role !== "TEACHER" && user.role !== "ADMIN") {
          throw new Error("UserAlreadyLoggedIn");
        }

        return {
          id: user.id,
          name: user.fullName,
          phoneNumber: user.phoneNumber,
          role: user.role,
        } as any;
      },
    }),
  ],
  session: {
    strategy: "jwt",
    // Remove maxAge to make sessions persist indefinitely
    updateAge: 0, // Disable session updates
  },
  jwt: {
    // Remove maxAge to make JWT tokens persist indefinitely
  },
  pages: {
    signIn: "/sign-in",
    error: "/sign-in",
  },
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        // User just logged in - create session
        const sessionId = await SessionManager.createSession(user.id);
        return {
          ...token,
          id: user.id,
          name: user.name,
          phoneNumber: user.phoneNumber,
          picture: (user as any).picture,
          role: user.role,
          sessionId: sessionId,
        };
      }
      return token;
    },
    async session({ token, session }) {
      if (!token || !token.sessionId) {
        // Initial login - use token data
        if (token) {
          session.user.id = token.id as string;
          session.user.name = token.name as string;
          session.user.phoneNumber = token.phoneNumber as string;
          session.user.image = token.picture as string | undefined;
          session.user.role = token.role as string;
        }
        return session;
      }

      // Validate session on every request
      const { user: validatedUser, isValid } = await SessionManager.validateSession(
        token.sessionId as string,
        token.id as string
      );

      if (!isValid) {
        // Return expired session to force re-authentication
        return {
          ...session,
          user: { id: "", name: "", email: "", role: "", phoneNumber: "", image: "" },
          expires: "1970-01-01T00:00:00.000Z"
        };
      }

      // Populate session with validated user data
      session.user.id = validatedUser?.id || (token.id as string);
      session.user.name = validatedUser?.fullName || (token.name as string);
      session.user.phoneNumber = validatedUser?.phoneNumber || (token.phoneNumber as string);
      session.user.image = validatedUser?.image || (token.picture as string | undefined);
      session.user.role = validatedUser?.role || (token.role as string);

      return session;
    },
  },
  debug: process.env.NODE_ENV === "development",
}; 