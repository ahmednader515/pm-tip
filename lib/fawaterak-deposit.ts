import { prismaWithFawaterakPending } from "@/lib/db";

/**
 * Idempotent credit for a paid Fawaterak invoice (used by webhook_json and optional return-URL sync).
 */
export async function applyFawaterakTopupDeposit(
  invoiceId: number,
  userId: string,
  amount: number
) {
  const id = Math.trunc(invoiceId);
  if (!Number.isFinite(id) || id <= 0) {
    throw new Error("Invalid invoice id");
  }
  if (!Number.isFinite(amount) || amount <= 0) {
    throw new Error("Invalid amount");
  }

  const invoiceMarker = `[FAWATERAK_INVOICE:${id}]`;
  const p = prismaWithFawaterakPending();

  const existingTransaction = await p.balanceTransaction.findFirst({
    where: {
      userId,
      type: "DEPOSIT",
      description: {
        contains: invoiceMarker,
      },
    },
    select: { id: true },
  });

  if (existingTransaction) {
    return { applied: false as const, reason: "already_credited" as const };
  }

  await p.$transaction(async (tx) => {
    await tx.user.update({
      where: { id: userId },
      data: {
        balance: {
          increment: amount,
        },
      },
    });

    await tx.balanceTransaction.create({
      data: {
        userId,
        amount,
        type: "DEPOSIT",
        description: `Fawaterak deposit ${amount.toFixed(2)} EGP ${invoiceMarker}`,
      },
    });

    await tx.fawaterakPendingInvoice.deleteMany({
      where: { invoiceId: id },
    });
  });

  return { applied: true as const };
}
