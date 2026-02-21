import type { PrismaClient } from "@prisma/client";
import type { Adapter } from "next-auth/adapters";

const stripUndefined = <T extends Record<string, unknown>>(obj: T) => {
  const data: Record<string, unknown> = {};
  for (const key in obj) {
    if (obj[key] !== undefined) {
      data[key] = obj[key];
    }
  }
  return { data };
};

const isPrismaKnownRequestError = (error: unknown, code: string) => {
  return (
    Boolean(error) &&
    typeof error === "object" &&
    "code" in error &&
    // @ts-ignore - runtime check only
    error.code === code
  );
};

export const prismaAdapter = (prisma: PrismaClient): Adapter => {
  const p = prisma;

  return {
    createUser: ({ id, ...data }) => p.user.create(stripUndefined(data)),
    getUser: (id) => p.user.findUnique({ where: { id } }),
    getUserByEmail: (email) => p.user.findUnique({ where: { email } }),
    async getUserByAccount(provider_providerAccountId) {
      const account = await p.account.findUnique({
        where: { provider_providerAccountId },
        include: { user: true },
      });
      return account?.user ?? null;
    },
    updateUser: ({ id, ...data }) =>
      p.user.update({
        where: { id },
        ...stripUndefined(data),
      }),
    deleteUser: (id) => p.user.delete({ where: { id } }),
    linkAccount: (data) => p.account.create({ data }),
    unlinkAccount: (provider_providerAccountId) =>
      p.account.delete({
        where: { provider_providerAccountId },
      }),
    async getSessionAndUser(sessionToken) {
      const userAndSession = await p.session.findUnique({
        where: { sessionToken },
        include: { user: true },
      });
      if (!userAndSession) return null;
      const { user, ...session } = userAndSession;
      return { user, session };
    },
    createSession: (data) => p.session.create(stripUndefined(data)),
    updateSession: (data) =>
      p.session.update({
        where: { sessionToken: data.sessionToken },
        ...stripUndefined(data),
      }),
    deleteSession: (sessionToken) =>
      p.session.delete({ where: { sessionToken } }),
    async createVerificationToken(data) {
      const verificationToken = await p.verificationToken.create(
        stripUndefined(data)
      );
      if ("id" in verificationToken && verificationToken.id) {
        delete verificationToken.id;
      }
      return verificationToken;
    },
    async useVerificationToken(identifier_token) {
      try {
        const verificationToken = await p.verificationToken.delete({
          where: { identifier_token },
        });
        if ("id" in verificationToken && verificationToken.id) {
          delete verificationToken.id;
        }
        return verificationToken;
      } catch (error) {
        if (isPrismaKnownRequestError(error, "P2025")) {
          return null;
        }
        throw error;
      }
    },
    async getAccount(providerAccountId, provider) {
      return p.account.findFirst({
        where: { providerAccountId, provider },
      });
    },
    async createAuthenticator(data) {
      return p.authenticator.create(stripUndefined(data));
    },
    async getAuthenticator(credentialID) {
      return p.authenticator.findUnique({
        where: { credentialID },
      });
    },
    async listAuthenticatorsByUserId(userId) {
      return p.authenticator.findMany({
        where: { userId },
      });
    },
    async updateAuthenticatorCounter(credentialID, counter) {
      return p.authenticator.update({
        where: { credentialID },
        data: { counter },
      });
    },
  };
};

