import type { Prisma } from "@prisma/client";
import type { DefaultArgs } from "@prisma/client/runtime/library";
import { PrismaClient } from "@prisma/client";
import { withAccelerate } from "@prisma/extension-accelerate";

const createPrismaClient = () =>
  new PrismaClient({
    datasources: {
      db: { url: process.env.DATABASE_URL },
    },
  }).$extends(withAccelerate());

declare global {
  // eslint-disable-next-line no-var
  var prisma: ReturnType<typeof createPrismaClient> | undefined;
}

export const db = globalThis.prisma ?? createPrismaClient();

/**
 * Same runtime client as `db`. `withAccelerate()`'s generated client type omits some model
 * delegates in TS; we intersect with the Prisma-generated delegate so `fawaterakPendingInvoice` type-checks.
 */
export type PrismaDbWithPending = Omit<typeof db, "fawaterakPendingInvoice"> & {
  fawaterakPendingInvoice: Prisma.FawaterakPendingInvoiceDelegate<
    DefaultArgs,
    Prisma.PrismaClientOptions
  >;
};

/** Prefer this over a bare `prismaDb` const — some TS servers widen the latter to `PrismaClient`. */
export function prismaWithFawaterakPending(): PrismaDbWithPending {
  return db as unknown as PrismaDbWithPending;
}

if (process.env.NODE_ENV !== "production") {
  globalThis.prisma = db;
}