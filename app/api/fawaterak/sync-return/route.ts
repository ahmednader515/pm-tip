import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prismaWithFawaterakPending } from "@/lib/db";
import { applyFawaterakTopupDeposit } from "@/lib/fawaterak-deposit";

function coerceInvoiceId(raw: unknown): number | null {
  if (typeof raw === "number" && Number.isFinite(raw)) {
    return Math.trunc(raw);
  }
  if (typeof raw === "string" && /^\d+$/.test(raw.trim())) {
    return parseInt(raw.trim(), 10);
  }
  return null;
}

/**
 * Called from the balance page after Fawaterak redirects with ?payment=success&invoice_id=...
 * Credits the wallet when a matching pending row exists (same user who started checkout).
 * Idempotent with the paid webhook. Disable with FAWATERAK_DISABLE_SUCCESS_PAGE_SYNC=true if you rely on webhook only.
 */
export async function POST(req: NextRequest) {
  try {
    if (process.env.FAWATERAK_DISABLE_SUCCESS_PAGE_SYNC === "true") {
      return NextResponse.json({ applied: false, reason: "sync_disabled" });
    }

    const session = await getServerSession(authOptions);
    const userId = session?.user?.id;
    if (!userId) {
      return new NextResponse("Unauthorized", { status: 401 });
    }

    const body = (await req.json()) as { invoiceId?: unknown };
    const invoiceId = coerceInvoiceId(body?.invoiceId);
    if (invoiceId == null) {
      return new NextResponse("Invalid invoiceId", { status: 400 });
    }

    const pending = await prismaWithFawaterakPending().fawaterakPendingInvoice.findFirst({
      where: { invoiceId, userId },
    });

    if (!pending) {
      return NextResponse.json({ applied: false, reason: "no_pending_invoice" });
    }

    const result = await applyFawaterakTopupDeposit(
      invoiceId,
      pending.userId,
      pending.amount
    );

    return NextResponse.json(result);
  } catch (error) {
    console.error("[FAWATERAK_SYNC_RETURN]", error);
    return new NextResponse("Internal Error", { status: 500 });
  }
}
